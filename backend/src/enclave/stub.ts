/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  STUB ENCLAVE — NOT A REAL TEE                                        │
 * │  Stands in for a TDX/confidential-GPU enclave for the MVP.           │
 * │  It decrypts the prompt, runs inference, and emits an ed25519-signed  │
 * │  quote in the real TDX field layout. The on-chain verifier runs the  │
 * │  genuine checks against it; swapping this for a real enclave changes  │
 * │  zero on-chain code. See prd.md §21 (Risk 1).                        │
 * └─────────────────────────────────────────────────────────────────────┘
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  openSealed,
  sealTo,
  buildQuote,
  commitString,
  commit,
  hexToBytes,
  edPublicFromSecret,
  type SealedBox,
  type AttestationQuote,
} from "@veilai/shared";
import { config } from "../config.js";

export interface EnclaveInput {
  /** Prompt sealed to the enclave's x25519 public key. */
  promptBox: SealedBox;
  /** x25519 public key to seal the output back to (the creator). */
  userPublicKeyB58: string;
  modelId: string;
  /** Per-job nonce (hex) binding the attestation. */
  nonce: string;
}

export interface EnclaveOutput {
  quote: AttestationQuote;
  inputCommitment: string;
  outputCommitment: string;
  /** Output sealed to the user; only the creator can open it. */
  outputBox: SealedBox;
}

/**
 * Runs one confidential job end to end inside the (stub) enclave boundary.
 * The enclave holds: its x25519 secret (to decrypt prompts) and its ed25519
 * quoting secret (to sign attestations). Neither ever leaves this module.
 */
export class StubEnclave {
  private readonly anthropic: Anthropic;

  constructor(
    /** x25519 secret used to decrypt inbound prompts. */
    private readonly x25519Secret: Uint8Array,
    /** ed25519 quoting secret (stands in for the TEE quoting key). */
    private readonly quotingSecret: Uint8Array,
    private readonly quotingKeyB58: string,
    /** Allowlisted measurement (MRTD) hex — the fixed identity of this enclave image. */
    private readonly measurementHex: string,
  ) {
    this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  }

  async run(input: EnclaveInput): Promise<EnclaveOutput> {
    // 1. Decrypt the prompt (only possible inside the enclave).
    const promptBytes = await openSealed(this.x25519Secret, input.promptBox);
    const prompt = new TextDecoder().decode(promptBytes);
    const inputCommitment = commitString(prompt);

    // 2. Run inference.
    const output = await this.infer(input.modelId, prompt);
    const outputCommitment = commitString(output);

    // 3. Seal the output back to the user.
    const outputBox = await sealTo(input.userPublicKeyB58, new TextEncoder().encode(output));

    // 4. Emit the attestation quote (signs sha256(report_data ‖ mrtd)).
    const quote = buildQuote({
      inputCommitment,
      outputCommitment,
      modelId: input.modelId,
      nonce: input.nonce,
      mrtd: this.measurementHex,
      quotingSecret: this.quotingSecret,
      quotingKeyB58: this.quotingKeyB58,
    });

    return { quote, inputCommitment, outputCommitment, outputBox };
  }

  private async infer(modelId: string, prompt: string): Promise<string> {
    if (!config.anthropicApiKey) {
      // Offline fallback so the pipeline is demoable without a key.
      return `[STUB ENCLAVE offline] Echoed analysis of a ${prompt.length}-char prompt (commitment ${commit(new TextEncoder().encode(prompt)).slice(0, 12)}…).`;
    }
    const msg = await this.anthropic.messages.create({
      model: modelId || "claude-opus-4-8",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
}

/** Build the enclave from env (stub quoting key + measurement). */
export function enclaveFromEnv(x25519Secret: Uint8Array): StubEnclave {
  const quotingSecret = hexToBytes(config.enclaveQuotingSecret || "00".repeat(32));
  const quotingKeyB58 = edPublicFromSecret(quotingSecret);
  const measurementHex = config.enclaveMeasurement || "ab".repeat(48);
  return new StubEnclave(x25519Secret, quotingSecret, quotingKeyB58, measurementHex);
}
