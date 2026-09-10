/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/veilai.json`.
 */
export type Veilai = {
  "address": "86unmnYc6pGfmmCwFLBjbiVT9pd3vJA5CaAzyreYewPT",
  "metadata": {
    "name": "veilai",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "VeilAI — private, verifiable execution infrastructure for AI agents"
  },
  "docs": [
    "VeilAI — private, verifiable execution infrastructure for AI agents.",
    "",
    "Phase 1 (this module): core job lifecycle on the base layer.",
    "PER delegation/permissions (Phase 2), attestation verification (Phase 3),",
    "and Magic Action settlement (Phase 4) are added incrementally — see plan.md."
  ],
  "instructions": [
    {
      "name": "closePermission",
      "docs": [
        "Close the job's EphemeralPermission on the ER (before undelegation)."
      ],
      "discriminator": [
        17,
        241,
        212,
        43,
        238,
        201,
        203,
        210
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "job"
          ]
        },
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "job.creator",
                "account": "job"
              },
              {
                "kind": "account",
                "path": "job.job_id",
                "account": "job"
              }
            ]
          }
        },
        {
          "name": "permission",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  114,
                  109,
                  105,
                  115,
                  115,
                  105,
                  111,
                  110,
                  58
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ],
            "program": {
              "kind": "account",
              "path": "permissionProgram"
            }
          }
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createJob",
      "docs": [
        "Create a confidential job. Only commitments are stored on-chain; the",
        "plaintext prompt never touches the account."
      ],
      "discriminator": [
        178,
        130,
        217,
        110,
        100,
        27,
        82,
        119
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "jobId"
              }
            ]
          }
        },
        {
          "name": "agent",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.authority",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "jobId",
          "type": "u64"
        },
        {
          "name": "promptCiphertextCommitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "inputCommitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "nonce",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "budget",
          "type": "u64"
        }
      ]
    },
    {
      "name": "delegateJob",
      "docs": [
        "Delegate the Job data PDA into the (private) Ephemeral Rollup (base layer)."
      ],
      "discriminator": [
        197,
        216,
        20,
        18,
        206,
        198,
        106,
        158
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferJob",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                105,
                133,
                102,
                196,
                205,
                220,
                161,
                158,
                145,
                208,
                80,
                105,
                187,
                176,
                8,
                233,
                202,
                184,
                170,
                205,
                146,
                51,
                207,
                131,
                89,
                84,
                84,
                102,
                64,
                43,
                228,
                198
              ]
            }
          }
        },
        {
          "name": "delegationRecordJob",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataJob",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "jobId"
              }
            ]
          }
        },
        {
          "name": "validator",
          "optional": true
        },
        {
          "name": "ownerProgram",
          "address": "86unmnYc6pGfmmCwFLBjbiVT9pd3vJA5CaAzyreYewPT"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "jobId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositEscrow",
      "docs": [
        "Escrow the job budget in a program-controlled USDC vault before",
        "execution — the funds verification will later release or refund."
      ],
      "discriminator": [
        226,
        112,
        158,
        176,
        178,
        118,
        153,
        128
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "job.job_id",
                "account": "job"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "job"
          ]
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "creatorAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "escrowAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  45,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ]
          }
        },
        {
          "name": "escrowVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "escrowAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "executeMarker",
      "docs": [
        "Provider marks the delegated job as executing (ER)."
      ],
      "discriminator": [
        163,
        69,
        162,
        57,
        107,
        208,
        164,
        30
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "job.creator",
                "account": "job"
              },
              {
                "kind": "account",
                "path": "job.job_id",
                "account": "job"
              }
            ]
          }
        },
        {
          "name": "provider",
          "signer": true,
          "relations": [
            "job"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initPermission",
      "docs": [
        "Create the job's EphemeralPermission on the ER (members = creator+provider)."
      ],
      "discriminator": [
        66,
        14,
        153,
        250,
        187,
        36,
        179,
        236
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "job"
          ]
        },
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "job.creator",
                "account": "job"
              },
              {
                "kind": "account",
                "path": "job.job_id",
                "account": "job"
              }
            ]
          }
        },
        {
          "name": "permission",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  114,
                  109,
                  105,
                  115,
                  115,
                  105,
                  111,
                  110,
                  58
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ],
            "program": {
              "kind": "account",
              "path": "permissionProgram"
            }
          }
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "members",
          "type": {
            "vec": {
              "defined": {
                "name": "member"
              }
            }
          }
        }
      ]
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "refundEscrowDirect",
      "docs": [
        "Refund escrow to the creator for a Rejected job (direct, Signer-authorized)."
      ],
      "discriminator": [
        131,
        24,
        42,
        151,
        250,
        18,
        147,
        22
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "job.creator",
                "account": "job"
              },
              {
                "kind": "account",
                "path": "job.job_id",
                "account": "job"
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.authority",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "escrowAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  45,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ]
          }
        },
        {
          "name": "escrowVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "escrowAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "creatorAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "job.creator",
                "account": "job"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "registerAgent",
      "docs": [
        "Register an AI provider/agent with its allowlisted enclave measurement,",
        "quoting key, model id, and price."
      ],
      "discriminator": [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "modelId",
          "type": "string"
        },
        {
          "name": "expectedMeasurement",
          "type": {
            "array": [
              "u8",
              48
            ]
          }
        },
        {
          "name": "quotingKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "price",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setPermission",
      "docs": [
        "Replace the job's EphemeralPermission member list on the ER."
      ],
      "discriminator": [
        70,
        126,
        41,
        194,
        245,
        189,
        128,
        8
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "job"
          ]
        },
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "job.creator",
                "account": "job"
              },
              {
                "kind": "account",
                "path": "job.job_id",
                "account": "job"
              }
            ]
          }
        },
        {
          "name": "permission",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  101,
                  114,
                  109,
                  105,
                  115,
                  115,
                  105,
                  111,
                  110,
                  58
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ],
            "program": {
              "kind": "account",
              "path": "permissionProgram"
            }
          }
        },
        {
          "name": "permissionProgram",
          "address": "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
        },
        {
          "name": "ephemeralVault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "isPrivate",
          "type": "bool"
        },
        {
          "name": "members",
          "type": {
            "vec": {
              "defined": {
                "name": "member"
              }
            }
          }
        }
      ]
    },
    {
      "name": "settlePaymentDirect",
      "docs": [
        "Release escrow to the provider for a Verified job (direct, Signer-authorized)."
      ],
      "discriminator": [
        42,
        211,
        40,
        116,
        175,
        28,
        134,
        62
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "job.creator",
                "account": "job"
              },
              {
                "kind": "account",
                "path": "job.job_id",
                "account": "job"
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent.authority",
                "account": "agent"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "escrowAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  45,
                  97,
                  117,
                  116,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "job"
              }
            ]
          }
        },
        {
          "name": "escrowVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "escrowAuthority"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "providerAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "job.provider",
                "account": "job"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "verifyAttestation",
      "docs": [
        "Verify the enclave attestation (Ed25519 precompile + measurement",
        "allowlist) and record Verified/Rejected. See `verify_attestation.rs`."
      ],
      "discriminator": [
        144,
        30,
        116,
        186,
        33,
        176,
        35,
        60
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  111,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "job.creator",
                "account": "job"
              },
              {
                "kind": "account",
                "path": "job.job_id",
                "account": "job"
              }
            ]
          }
        },
        {
          "name": "provider",
          "signer": true,
          "relations": [
            "job"
          ]
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "outputCommitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "mrtd",
          "type": {
            "array": [
              "u8",
              48
            ]
          }
        },
        {
          "name": "signature",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        },
        {
          "name": "ed25519IxIndex",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agent",
      "discriminator": [
        47,
        166,
        112,
        147,
        155,
        197,
        86,
        7
      ]
    },
    {
      "name": "job",
      "discriminator": [
        75,
        124,
        80,
        203,
        161,
        180,
        202,
        80
      ]
    }
  ],
  "events": [
    {
      "name": "attestationRejected",
      "discriminator": [
        254,
        30,
        75,
        73,
        73,
        241,
        244,
        196
      ]
    },
    {
      "name": "attestationVerified",
      "discriminator": [
        98,
        148,
        167,
        161,
        88,
        59,
        107,
        231
      ]
    },
    {
      "name": "jobRefunded",
      "discriminator": [
        156,
        171,
        111,
        37,
        17,
        174,
        8,
        167
      ]
    },
    {
      "name": "jobSettled",
      "discriminator": [
        130,
        105,
        205,
        34,
        87,
        86,
        152,
        27
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Caller is not authorized for this action"
    },
    {
      "code": 6001,
      "name": "badStatus",
      "msg": "Job is not in the required status for this action"
    },
    {
      "code": 6002,
      "name": "tooManyMembers",
      "msg": "Permission member count exceeds MAX_PERMISSION_MEMBERS"
    },
    {
      "code": 6003,
      "name": "measurementMismatch",
      "msg": "Enclave measurement does not match the agent allowlist"
    },
    {
      "code": 6004,
      "name": "quoteInvalid",
      "msg": "Attestation quote is invalid"
    },
    {
      "code": 6005,
      "name": "quotingKeyMismatch",
      "msg": "Quoting key is not allowlisted for this agent"
    },
    {
      "code": 6006,
      "name": "reportDataMismatch",
      "msg": "Report data binding does not match the job commitments"
    },
    {
      "code": 6007,
      "name": "invalidDelegationRecord",
      "msg": "Delegation record is malformed"
    },
    {
      "code": 6008,
      "name": "alreadySettled",
      "msg": "Job has already been settled"
    },
    {
      "code": 6009,
      "name": "modelIdTooLong",
      "msg": "Model identifier is too long"
    },
    {
      "code": 6010,
      "name": "invalidBudget",
      "msg": "Budget must be greater than zero"
    }
  ],
  "types": [
    {
      "name": "agent",
      "docs": [
        "A registered AI provider/agent. One agent per provider wallet in the MVP."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "modelId",
            "docs": [
              "Model identifier used when recomputing the attestation report data."
            ],
            "type": "string"
          },
          {
            "name": "expectedMeasurement",
            "docs": [
              "Allowlisted enclave measurement (MRTD)."
            ],
            "type": {
              "array": [
                "u8",
                48
              ]
            }
          },
          {
            "name": "quotingKey",
            "docs": [
              "ed25519 public key of the enclave quoting key (stub TEE key in the MVP)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "docs": [
              "Price per job, USDC base units."
            ],
            "type": "u64"
          },
          {
            "name": "completed",
            "type": "u64"
          },
          {
            "name": "verified",
            "type": "u64"
          },
          {
            "name": "rejected",
            "type": "u64"
          },
          {
            "name": "reputation",
            "docs": [
              "Reputation, basis points (0..=10_000)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "attestationRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "attestationStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "none"
          },
          {
            "name": "submitted"
          },
          {
            "name": "verified"
          },
          {
            "name": "rejected"
          }
        ]
      }
    },
    {
      "name": "attestationVerified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "outputCommitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "job",
      "docs": [
        "A confidential job. Sensitive plaintext never lives here — only commitments."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "docs": [
              "The Agent PDA selected for this job."
            ],
            "type": "pubkey"
          },
          {
            "name": "provider",
            "docs": [
              "Provider wallet (agent.authority), copied so ER-side auth needs no agent read."
            ],
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "jobStatus"
              }
            }
          },
          {
            "name": "attestationStatus",
            "type": {
              "defined": {
                "name": "attestationStatus"
              }
            }
          },
          {
            "name": "budget",
            "docs": [
              "USDC base units held in escrow for this job."
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "promptCiphertextCommitment",
            "docs": [
              "sha256 of the ciphertext handed to the enclave."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "inputCommitment",
            "docs": [
              "Commitment to the plaintext input (bound into report_data)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "outputCommitment",
            "docs": [
              "Commitment to the output, recorded on verification."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "expectedMeasurement",
            "docs": [
              "Copied from the agent at creation so the allowlist is fixed for the job."
            ],
            "type": {
              "array": [
                "u8",
                48
              ]
            }
          },
          {
            "name": "quotingKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "modelId",
            "docs": [
              "Copied from the agent; needed to recompute report_data on-chain."
            ],
            "type": "string"
          },
          {
            "name": "nonce",
            "docs": [
              "Random per-job nonce binding the attestation."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "settlementId",
            "docs": [
              "Idempotency key guarding settlement."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "settled",
            "docs": [
              "True once escrow has been released or refunded (guards double-settle)."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "jobRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "to",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "jobSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "to",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "jobStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "created"
          },
          {
            "name": "escrowed"
          },
          {
            "name": "executing"
          },
          {
            "name": "verified"
          },
          {
            "name": "rejected"
          },
          {
            "name": "settled"
          }
        ]
      }
    },
    {
      "name": "member",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "flags",
            "type": "u8"
          },
          {
            "name": "pubkey",
            "type": "pubkey"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "agentSeed",
      "docs": [
        "PDA seed prefixes — mirrored in `shared/src/config.ts`."
      ],
      "type": "bytes",
      "value": "[97, 103, 101, 110, 116]"
    },
    {
      "name": "escrowAuthSeed",
      "type": "bytes",
      "value": "[101, 115, 99, 114, 111, 119, 45, 97, 117, 116, 104]"
    },
    {
      "name": "jobSeed",
      "type": "bytes",
      "value": "[106, 111, 98]"
    }
  ]
};
