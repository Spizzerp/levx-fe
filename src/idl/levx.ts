/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/levx.json`.
 */
export type Levx = {
  "address": "BQ96FzD16VGxord1vPeoYbAibZ1KTvW4oH29XuvqYyte",
  "metadata": {
    "name": "levx",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "activateMarket",
      "discriminator": [
        10,
        26,
        197,
        116,
        113,
        99,
        72,
        89
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "cranker",
          "docs": [
            "Anyone can crank this (permissionless).",
            "remaining_accounts: all PathOutcome accounts for this market (for freshness check)."
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "addPath",
      "discriminator": [
        173,
        144,
        101,
        58,
        144,
        107,
        129,
        117
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "pathOutcome",
          "writable": true
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
          "name": "params",
          "type": {
            "defined": {
              "name": "addPathParams"
            }
          }
        }
      ]
    },
    {
      "name": "addSupportedPair",
      "discriminator": [
        128,
        207,
        52,
        183,
        219,
        201,
        191,
        230
      ],
      "accounts": [
        {
          "name": "protocolState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "baseMint",
          "type": "pubkey"
        },
        {
          "name": "quoteMint",
          "type": "pubkey"
        },
        {
          "name": "pythFeedId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "checkDissolution",
      "discriminator": [
        43,
        26,
        246,
        111,
        207,
        62,
        15,
        240
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "pathOutcome",
          "writable": true
        },
        {
          "name": "priceSample",
          "docs": [
            "The most recent PriceSample for this market."
          ]
        },
        {
          "name": "keeper",
          "docs": [
            "Permissionless keeper"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "checkDissolutionBatch",
      "docs": [
        "Batch dissolution: process all paths for one checkpoint in a single tx.",
        "Paths passed via remaining_accounts. Cuts N_paths txs to 1 per checkpoint."
      ],
      "discriminator": [
        231,
        124,
        113,
        235,
        149,
        156,
        69,
        153
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "priceSample",
          "docs": [
            "The most recent PriceSample for this market."
          ]
        },
        {
          "name": "keeper",
          "docs": [
            "Permissionless keeper"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "pathOutcome"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury — receives settlement rake share"
          ],
          "writable": true
        },
        {
          "name": "insuranceFund",
          "docs": [
            "Insurance fund — receives settlement rake share"
          ],
          "writable": true
        },
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimFor",
      "docs": [
        "Permissionless claim: keeper triggers payout on behalf of a user.",
        "Tokens go to position owner's ATA, not the caller."
      ],
      "discriminator": [
        245,
        67,
        97,
        44,
        59,
        223,
        144,
        1
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "pathOutcome"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "docs": [
            "The position owner's token account. Keeper provides this but tokens",
            "go to the position owner, verified by constraint below."
          ],
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury — receives settlement rake share"
          ],
          "writable": true
        },
        {
          "name": "insuranceFund",
          "docs": [
            "Insurance fund — receives settlement rake share"
          ],
          "writable": true
        },
        {
          "name": "keeper",
          "docs": [
            "Permissionless keeper — NOT the position owner. Pays TX fee only."
          ],
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createMarket",
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "protocolState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "protocol_state.total_markets_created",
                "account": "protocolState"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "signer": true
        },
        {
          "name": "collateralMint"
        },
        {
          "name": "insuranceFund",
          "docs": [
            "Insurance fund receives the market creation fee"
          ],
          "writable": true
        },
        {
          "name": "creatorTokenAccount",
          "docs": [
            "Creator's USDC token account — pays the creation fee"
          ],
          "writable": true
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createMarketParams"
            }
          }
        }
      ]
    },
    {
      "name": "disputeSettlement",
      "discriminator": [
        4,
        60,
        11,
        150,
        42,
        129,
        191,
        152
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "disputer",
          "docs": [
            "Anyone can dispute"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "exitPosition",
      "discriminator": [
        130,
        193,
        80,
        25,
        78,
        132,
        189,
        111
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "pathOutcome",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "remaining_accounts[0]: Optional EigenCache (mut) — for quantum-correlated",
            "pricing and perturbation. Loaded via eigen_utils::load_eigen_cache()."
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "finalizeMarket",
      "discriminator": [
        16,
        225,
        38,
        28,
        213,
        217,
        1,
        247
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "cranker",
          "docs": [
            "Permissionless"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initEigenCache",
      "discriminator": [
        106,
        174,
        36,
        13,
        154,
        176,
        77,
        62
      ],
      "accounts": [
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "eigenCache",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  105,
                  103,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeProtocol",
      "discriminator": [
        188,
        233,
        252,
        106,
        134,
        146,
        202,
        91
      ],
      "accounts": [
        {
          "name": "protocolState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
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
          "name": "treasury"
        },
        {
          "name": "insuranceFund"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeVault",
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "levVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  118,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
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
      "args": []
    },
    {
      "name": "placeWager",
      "discriminator": [
        225,
        163,
        84,
        25,
        21,
        42,
        138,
        30
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "pathOutcome",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury token account — receives 80% of entry fee"
          ],
          "writable": true
        },
        {
          "name": "insuranceFund",
          "docs": [
            "Insurance fund token account — receives 20% of entry fee"
          ],
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "remaining_accounts[0]: Optional EigenCache (mut) — pass the PDA if a",
            "verified eigendecomp is available, or omit for λ=0 fallback.",
            "Loaded via eigen_utils::load_eigen_cache() to avoid BPF stack overflow."
          ],
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "pathIndex",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "uphold",
          "type": "bool"
        }
      ]
    },
    {
      "name": "sampleAndDissolve",
      "docs": [
        "Combined sample + dissolve: sample oracle checkpoint and process all",
        "paths' decoherence in one transaction. Paths via remaining_accounts."
      ],
      "discriminator": [
        247,
        224,
        47,
        162,
        100,
        101,
        140,
        39
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "priceSample",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  109,
                  112,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              },
              {
                "kind": "arg",
                "path": "checkpointIndex"
              }
            ]
          }
        },
        {
          "name": "pythPriceUpdate",
          "docs": [
            "Pyth PriceUpdateV2 account — must be owned by the Pyth Receiver Program."
          ]
        },
        {
          "name": "keeper",
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
          "name": "checkpointIndex",
          "type": "u16"
        }
      ]
    },
    {
      "name": "samplePrice",
      "discriminator": [
        15,
        172,
        110,
        234,
        15,
        105,
        46,
        55
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "priceSample",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  109,
                  112,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              },
              {
                "kind": "arg",
                "path": "checkpointIndex"
              }
            ]
          }
        },
        {
          "name": "pythPriceUpdate",
          "docs": [
            "Pyth PriceUpdateV2 account — must be owned by the Pyth Receiver Program.",
            "The keeper posts the price update to Pyth's receiver program in a prior",
            "instruction within the same transaction. We read the verified result here."
          ]
        },
        {
          "name": "keeper",
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
          "name": "checkpointIndex",
          "type": "u16"
        }
      ]
    },
    {
      "name": "scoreAllPaths",
      "docs": [
        "Batch scoring: score all surviving paths in one transaction.",
        "Paths passed via remaining_accounts."
      ],
      "discriminator": [
        159,
        68,
        211,
        242,
        141,
        109,
        42,
        22
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "keeper",
          "docs": [
            "Permissionless keeper"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "scorePath",
      "discriminator": [
        122,
        82,
        125,
        20,
        70,
        241,
        94,
        152
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "pathOutcome",
          "writable": true
        },
        {
          "name": "keeper",
          "docs": [
            "Permissionless keeper"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "settleAndFinalize",
      "docs": [
        "Combined settle + finalize: settles and, if maturity window is zero or",
        "already elapsed, finalizes in one transaction. Falls back to Maturing",
        "if maturity window is still active."
      ],
      "discriminator": [
        136,
        163,
        246,
        28,
        112,
        234,
        250,
        113
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "cranker",
          "docs": [
            "Permissionless"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "settleMarket",
      "discriminator": [
        193,
        153,
        95,
        216,
        166,
        6,
        144,
        217
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "cranker",
          "docs": [
            "Permissionless"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "submitEigendecomp",
      "discriminator": [
        159,
        124,
        73,
        248,
        239,
        6,
        149,
        18
      ],
      "accounts": [
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "eigenCache",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  105,
                  103,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "keeper",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "eigenvalues",
          "type": {
            "vec": "i64"
          }
        },
        {
          "name": "eigenvectorsFlat",
          "type": {
            "vec": "i64"
          }
        }
      ]
    },
    {
      "name": "voidMarket",
      "discriminator": [
        243,
        175,
        46,
        124,
        95,
        101,
        39,
        69
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "cranker",
          "docs": [
            "Permissionless"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "voidMarketGovernance",
      "discriminator": [
        13,
        211,
        25,
        212,
        91,
        228,
        59,
        239
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "eigenCache",
      "discriminator": [
        211,
        253,
        217,
        80,
        231,
        215,
        20,
        120
      ]
    },
    {
      "name": "levVault",
      "discriminator": [
        126,
        56,
        31,
        33,
        68,
        83,
        245,
        126
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "pathOutcome",
      "discriminator": [
        19,
        217,
        237,
        13,
        108,
        43,
        32,
        129
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    },
    {
      "name": "priceSample",
      "discriminator": [
        54,
        226,
        181,
        40,
        71,
        220,
        77,
        24
      ]
    },
    {
      "name": "protocolState",
      "discriminator": [
        33,
        51,
        173,
        134,
        35,
        140,
        195,
        248
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "marketPendingNoWagers",
      "msg": "Market is in Pending state; wagers are not yet accepted"
    },
    {
      "code": 6001,
      "name": "marketSettlingRejected",
      "msg": "Market is in Settling state; no new wagers or exits accepted"
    },
    {
      "code": 6002,
      "name": "marketMaturingRejected",
      "msg": "Market is in Maturing state; claims not yet available (verification window active)"
    },
    {
      "code": 6003,
      "name": "marketSettledRejected",
      "msg": "Market has been settled; no further actions except claim"
    },
    {
      "code": 6004,
      "name": "marketVoidedRejected",
      "msg": "Market has been voided; use claim to recover collateral"
    },
    {
      "code": 6005,
      "name": "insufficientPaths",
      "msg": "Market activation rejected; fewer than 3 paths registered"
    },
    {
      "code": 6006,
      "name": "marketNotStarted",
      "msg": "Market activation rejected; start_time has not been reached"
    },
    {
      "code": 6007,
      "name": "pathFreshnessExpired",
      "msg": "Market activation rejected; AI path exceeds freshness window"
    },
    {
      "code": 6008,
      "name": "maxPathsReached",
      "msg": "Maximum number of paths (16) reached"
    },
    {
      "code": 6009,
      "name": "invalidMarketState",
      "msg": "Market is not in the expected state for this operation"
    },
    {
      "code": 6010,
      "name": "alreadyClaimed",
      "msg": "Position has already been claimed"
    },
    {
      "code": 6011,
      "name": "pathDissolved",
      "msg": "Cannot wager on dissolved path"
    },
    {
      "code": 6012,
      "name": "unauthorized",
      "msg": "Unauthorized signer for this operation"
    },
    {
      "code": 6013,
      "name": "checkpointMismatch",
      "msg": "Checkpoint count mismatch"
    },
    {
      "code": 6014,
      "name": "wagersNotAccepted",
      "msg": "Market is not accepting wagers in current state"
    },
    {
      "code": 6015,
      "name": "wagerTooSmall",
      "msg": "Wager amount too small or yields zero shares"
    },
    {
      "code": 6016,
      "name": "checkpointNotDue",
      "msg": "Checkpoint not yet due"
    },
    {
      "code": 6017,
      "name": "checkpointAlreadySampled",
      "msg": "Checkpoint already sampled"
    },
    {
      "code": 6018,
      "name": "oracleConfidenceTooLow",
      "msg": "Oracle confidence too low or price invalid"
    },
    {
      "code": 6019,
      "name": "tooManySkippedCheckpoints",
      "msg": "Too many checkpoints skipped; market should be voided"
    },
    {
      "code": 6020,
      "name": "tradingCutoffReached",
      "msg": "Trading window closed; market has passed 75% of checkpoints"
    },
    {
      "code": 6021,
      "name": "pathAlreadyDissolved",
      "msg": "Path has already been dissolved"
    },
    {
      "code": 6022,
      "name": "quantumStateCollapsed",
      "msg": "All path amplitudes collapsed to zero"
    },
    {
      "code": 6023,
      "name": "eigenNonConvergence",
      "msg": "Eigendecomposition did not converge within iteration limit"
    },
    {
      "code": 6024,
      "name": "eigenVerificationFailed",
      "msg": "Eigendecomposition verification failed: reconstruction error exceeds tolerance"
    },
    {
      "code": 6025,
      "name": "lambdaExceedsMax",
      "msg": "Lambda exceeds maximum allowed coupling strength"
    },
    {
      "code": 6026,
      "name": "nudgeRateExceedsMax",
      "msg": "Nudge rate exceeds maximum (500_000 = 50%)"
    },
    {
      "code": 6027,
      "name": "settlementIncomplete",
      "msg": "Settlement not complete; not all paths scored"
    },
    {
      "code": 6028,
      "name": "marketNotSettled",
      "msg": "Market not in Settled or Void state; cannot claim"
    },
    {
      "code": 6029,
      "name": "noSurvivingPaths",
      "msg": "No surviving paths to settle"
    },
    {
      "code": 6030,
      "name": "invalidScoringWeights",
      "msg": "Invalid scoring weights; must sum to 10000"
    },
    {
      "code": 6031,
      "name": "invalidPathIndex",
      "msg": "Invalid path index"
    },
    {
      "code": 6032,
      "name": "maturityNotElapsed",
      "msg": "Maturity window has not elapsed; cannot finalize"
    },
    {
      "code": 6033,
      "name": "marketDisputed",
      "msg": "Market is disputed; paused for governance review"
    },
    {
      "code": 6034,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6035,
      "name": "divisionByZero",
      "msg": "Division by zero"
    },
    {
      "code": 6036,
      "name": "invalidFee",
      "msg": "Invalid fee configuration"
    },
    {
      "code": 6037,
      "name": "feeExceedsCap",
      "msg": "Fee exceeds maximum cap (5%)"
    },
    {
      "code": 6038,
      "name": "leverageNotEnabled",
      "msg": "Leverage is not enabled for this market"
    },
    {
      "code": 6039,
      "name": "leverageExceedsMaximum",
      "msg": "Leverage exceeds maximum for this market's timeframe"
    },
    {
      "code": 6040,
      "name": "vaultInsufficientCapacity",
      "msg": "Insufficient vault capacity for this leveraged position"
    },
    {
      "code": 6041,
      "name": "vaultUtilizationExceeded",
      "msg": "Vault utilization would exceed maximum after this borrow"
    },
    {
      "code": 6042,
      "name": "leveragedOiCapExceeded",
      "msg": "Market leveraged open interest cap would be exceeded"
    },
    {
      "code": 6043,
      "name": "positionUnderwater",
      "msg": "Position health factor below liquidation threshold"
    },
    {
      "code": 6044,
      "name": "positionHealthy",
      "msg": "Position health factor is above liquidation threshold; cannot liquidate"
    },
    {
      "code": 6045,
      "name": "unauthorizedBackstopLiquidator",
      "msg": "Caller is not the configured backstop liquidator"
    },
    {
      "code": 6046,
      "name": "backstopLiquidatorDisabled",
      "msg": "Backstop liquidator is disabled"
    },
    {
      "code": 6047,
      "name": "backstopGracePeriodActive",
      "msg": "Backstop grace period has not elapsed; regular keepers have priority"
    },
    {
      "code": 6048,
      "name": "bucketGuardCooldown",
      "msg": "Operation rate-limited; cooldown period has not elapsed"
    }
  ],
  "types": [
    {
      "name": "addPathParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "predictedPrices",
            "type": {
              "vec": "u64"
            }
          },
          {
            "name": "numCheckpoints",
            "type": "u16"
          },
          {
            "name": "initialProbabilityBps",
            "type": "u16"
          },
          {
            "name": "generationMethod",
            "type": {
              "defined": {
                "name": "pathOrigin"
              }
            }
          },
          {
            "name": "generationTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "createMarketParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "pythFeedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "checkpointInterval",
            "type": "u32"
          },
          {
            "name": "actionAlpha",
            "type": "u64"
          },
          {
            "name": "actionBeta",
            "type": "u64"
          },
          {
            "name": "decoherenceRate",
            "type": "u64"
          },
          {
            "name": "minimumProbability",
            "type": "u64"
          },
          {
            "name": "pathMaxAge",
            "type": "i64"
          },
          {
            "name": "lambda",
            "docs": [
              "Quantum coupling strength (0 = no correlation, reduces to LMSR pricing)."
            ],
            "type": "u64"
          },
          {
            "name": "referenceAction",
            "docs": [
              "Expected action of a random-walk path over the market duration.",
              "Used by exponential scoring: score = exp(-action / reference_action).",
              "Keeper computes off-chain from historical volatility."
            ],
            "type": "u64"
          },
          {
            "name": "weightQv",
            "docs": [
              "Multi-feature scoring weights (fixed-point 6 dec, sum ≈ SCALE).",
              "Features modulate action score as penalties."
            ],
            "type": "u64"
          },
          {
            "name": "weightDd",
            "type": "u64"
          },
          {
            "name": "weightEndpoint",
            "type": "u64"
          },
          {
            "name": "weightDisplacement",
            "type": "u64"
          },
          {
            "name": "nudgeRate",
            "docs": [
              "LMSR oracle nudge rate (fixed-point 6 dec). Default 50_000 (5%).",
              "0 = disabled. Per-checkpoint zero-sum quantity adjustment from oracle data."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eigenCache",
      "docs": [
        "Cached eigendecomposition for a market's quantum cost function.",
        "",
        "Populated by `submit_eigendecomp` (permissionless keeper).",
        "Read by `place_wager` and `exit_position` for quantum-correlated pricing.",
        "",
        "Uses Vec fields with #[max_len] instead of fixed arrays to avoid",
        "BPF stack overflow during Anchor's init serialization.",
        "",
        "Fresh when `version == market.eigendecomp_version`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "docs": [
              "The market this decomposition is for."
            ],
            "type": "pubkey"
          },
          {
            "name": "eigenvalues",
            "docs": [
              "Eigenvalues of M = (diag(q) + λK) / b, fixed-point i64."
            ],
            "type": {
              "vec": "i64"
            }
          },
          {
            "name": "eigenvectorsFlat",
            "docs": [
              "Eigenvector matrix Q (row-major: entry [i*n + k] = k-th component of i-th eigenvector).",
              "This is the TRANSPOSE of the Jacobi output (which stores eigenvectors as columns)."
            ],
            "type": {
              "vec": "i64"
            }
          },
          {
            "name": "numPaths",
            "docs": [
              "Number of active curated paths when this was computed."
            ],
            "type": "u8"
          },
          {
            "name": "version",
            "docs": [
              "Matches market.eigendecomp_version when fresh."
            ],
            "type": "u64"
          },
          {
            "name": "needsRefresh",
            "docs": [
              "Set when a large trade exceeds perturbation safety threshold.",
              "Keeper checks this flag and resubmits full eigendecomp when set."
            ],
            "type": "bool"
          },
          {
            "name": "cachedPrices",
            "docs": [
              "Quantum prices at checkpoint time: p_i = Σ_k |Q[i][k]|² × exp(λ_k) / Tr(exp(M))"
            ],
            "type": {
              "vec": "u64"
            }
          },
          {
            "name": "lipschitzConstant",
            "docs": [
              "Lipschitz constant L = SCALE² / b for the quadratic payment rule.",
              "Between checkpoints: cost = p_eff × s + (L/2) × s² where p_eff = cached_p + L × Δq."
            ],
            "type": "u64"
          },
          {
            "name": "checkpointQuantities",
            "docs": [
              "Share quantities when this eigendecomp was computed.",
              "Delta from checkpoint: Δq_i = market.lmsr_share_quantities[i] - checkpoint_quantities[i]"
            ],
            "type": {
              "vec": "i64"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "levVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vaultUsdc",
            "type": "pubkey"
          },
          {
            "name": "levusdMint",
            "type": "pubkey"
          },
          {
            "name": "totalDeposits",
            "type": "u64"
          },
          {
            "name": "totalBorrowed",
            "type": "u64"
          },
          {
            "name": "totalReserved",
            "type": "u64"
          },
          {
            "name": "utilizationRate",
            "docs": [
              "total_borrowed / total_deposits (fixed-point 6 dec)"
            ],
            "type": "u64"
          },
          {
            "name": "accumulatedBorrowFees",
            "type": "u64"
          },
          {
            "name": "accumulatedLiquidationFees",
            "type": "u64"
          },
          {
            "name": "accumulatedSettleShare",
            "type": "u64"
          },
          {
            "name": "maxUtilizationBps",
            "type": "u16"
          },
          {
            "name": "baseBorrowRateBps",
            "type": "u16"
          },
          {
            "name": "kinkUtilizationBps",
            "type": "u16"
          },
          {
            "name": "kinkBorrowRateBps",
            "type": "u16"
          },
          {
            "name": "maxBorrowRateBps",
            "type": "u16"
          },
          {
            "name": "maxPayoutPerMarketBps",
            "type": "u16"
          },
          {
            "name": "liquidationFeeBps",
            "type": "u16"
          },
          {
            "name": "keeperRewardBps",
            "type": "u16"
          },
          {
            "name": "withdrawalCooldown",
            "type": "i64"
          },
          {
            "name": "pendingWithdrawals",
            "type": "u64"
          },
          {
            "name": "totalOutstandingProfitClaims",
            "type": "u64"
          },
          {
            "name": "haircutRatio",
            "docs": [
              "h = min(1, vault_residual / total_profit_claims); fixed-point 6 dec"
            ],
            "type": "u64"
          },
          {
            "name": "profitWarmupCheckpoints",
            "type": "u16"
          },
          {
            "name": "numPairBuffers",
            "type": "u8"
          },
          {
            "name": "currentShortfall",
            "docs": [
              "USDC amount of unresolved bad debt (6 decimals)"
            ],
            "type": "u64"
          },
          {
            "name": "haircutActive",
            "docs": [
              "True when haircut ratio H < 1.0 (quick-read flag)"
            ],
            "type": "bool"
          },
          {
            "name": "pairShortfallCount",
            "docs": [
              "Number of pair buffers currently in deficit"
            ],
            "type": "u64"
          },
          {
            "name": "backstopLiquidator",
            "docs": [
              "Governance-configured fallback liquidator. system_program::ID = disabled."
            ],
            "type": "pubkey"
          },
          {
            "name": "backstopGracePeriod",
            "docs": [
              "Seconds before backstop can act after health drops. Default 300."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "pythFeedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "checkpointInterval",
            "type": "u32"
          },
          {
            "name": "totalCheckpoints",
            "type": "u16"
          },
          {
            "name": "completedCheckpoints",
            "type": "u16"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "marketState"
              }
            }
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "totalPool",
            "type": "u64"
          },
          {
            "name": "totalLeveragedNotional",
            "type": "u64"
          },
          {
            "name": "lmsrAlpha",
            "docs": [
              "Alpha parameter for adaptive liquidity: b = α × Σ|q_j| (fixed-point 6 dec; default 50_000 = 0.05)"
            ],
            "type": "u64"
          },
          {
            "name": "lmsrShareQuantities",
            "docs": [
              "Share quantities per path. Input to both LMSR and quantum cost functions."
            ],
            "type": {
              "array": [
                "i64",
                16
              ]
            }
          },
          {
            "name": "lambda",
            "docs": [
              "Quantum coupling strength. 0 = no inter-path correlation (reduces to LMSR)."
            ],
            "type": "u64"
          },
          {
            "name": "eigendecompVersion",
            "docs": [
              "Monotonic counter incremented on every trade that changes quantities.",
              "EigenCache is fresh only when its version matches this value."
            ],
            "type": "u64"
          },
          {
            "name": "actionAlpha",
            "docs": [
              "Alpha coefficient for price term: S = α(Δp)² + β(Δv)². Default: 700_000 (0.7)"
            ],
            "type": "u64"
          },
          {
            "name": "actionBeta",
            "docs": [
              "Beta coefficient for velocity term. Default: 300_000 (0.3)"
            ],
            "type": "u64"
          },
          {
            "name": "amplitudes",
            "docs": [
              "Amplitude for each path. Born rule: probability ~ |ψ_i|²"
            ],
            "type": {
              "array": [
                "u64",
                16
              ]
            }
          },
          {
            "name": "amplitudeScale",
            "docs": [
              "Scale factor for amplitude normalization. Default: 1_000_000"
            ],
            "type": "u64"
          },
          {
            "name": "decoherenceRate",
            "docs": [
              "Rate at which deviating paths decohere. Default: 500_000 (0.5)"
            ],
            "type": "u64"
          },
          {
            "name": "minimumProbability",
            "docs": [
              "Minimum Born probability below which a path decoheres. Default: 10_000 (1%)",
              "Independent of path count — always means \"below X% implied probability.\""
            ],
            "type": "u64"
          },
          {
            "name": "nudgeRate",
            "docs": [
              "LMSR oracle nudge rate (fixed-point 6 dec). Default: 50_000 (5%).",
              "After each checkpoint, surviving paths' LMSR quantities are nudged toward",
              "better-tracking paths (lower action → positive nudge). Zero-sum across paths.",
              "Set to 0 to disable oracle-informed pricing."
            ],
            "type": "u64"
          },
          {
            "name": "feeEntryBpsOverride",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "feeSettleBpsOverride",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "leverageEnabled",
            "type": "bool"
          },
          {
            "name": "maxLeverage",
            "type": "u8"
          },
          {
            "name": "maxLeveragedOi",
            "type": "u64"
          },
          {
            "name": "currentLeveragedOi",
            "type": "u64"
          },
          {
            "name": "numPaths",
            "type": "u8"
          },
          {
            "name": "numPositions",
            "type": "u32"
          },
          {
            "name": "partialPayoutsDistributed",
            "type": "u64"
          },
          {
            "name": "maturityDuration",
            "type": "i64"
          },
          {
            "name": "maturityEndTime",
            "type": "i64"
          },
          {
            "name": "maturityDisputed",
            "type": "bool"
          },
          {
            "name": "pathMaxAge",
            "type": "i64"
          },
          {
            "name": "referenceScore",
            "docs": [
              "ELF reference score. Set to 0 for standard parimutuel behavior.",
              "When > 0, paths scoring below this threshold get zero payout (ELF mechanism).",
              "Governance can raise this once real market data calibrates reference_action."
            ],
            "type": "u64"
          },
          {
            "name": "totalWeightedExcess",
            "docs": [
              "Sum of (max(0, score - reference_score) × total_wagered) for surviving paths.",
              "When reference_score = 0, this equals the old total_weighted_score."
            ],
            "type": "u128"
          },
          {
            "name": "totalWeightedFallback",
            "docs": [
              "Sum of (score × total_wagered) for surviving paths — fallback denominator",
              "used when all paths score below reference_score (total_weighted_excess = 0)."
            ],
            "type": "u128"
          },
          {
            "name": "pathsScored",
            "docs": [
              "Number of paths that have been scored during settling."
            ],
            "type": "u8"
          },
          {
            "name": "pathsDissolved",
            "docs": [
              "Number of dissolved paths (incremented in check_dissolution)."
            ],
            "type": "u8"
          },
          {
            "name": "referenceAction",
            "docs": [
              "Expected action of a random-walk path over the market duration.",
              "Used by exponential scoring: score = exp(-action / reference_action).",
              "Set at market creation from historical volatility. Eliminates the",
              "keeper-supplied max_action parameter and its griefing vector."
            ],
            "type": "u64"
          },
          {
            "name": "weightQv",
            "docs": [
              "QV error weight. Default: 375_000 (37.5% of feature budget)"
            ],
            "type": "u64"
          },
          {
            "name": "weightDd",
            "docs": [
              "Max drawdown error weight. Default: 375_000 (37.5% of feature budget)"
            ],
            "type": "u64"
          },
          {
            "name": "weightEndpoint",
            "docs": [
              "Endpoint error weight. Default: 125_000 (12.5% of feature budget)"
            ],
            "type": "u64"
          },
          {
            "name": "weightDisplacement",
            "docs": [
              "Displacement error weight. Default: 125_000 (12.5% of feature budget)"
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
      "name": "marketState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "active"
          },
          {
            "name": "sampling"
          },
          {
            "name": "settling"
          },
          {
            "name": "maturing"
          },
          {
            "name": "settled"
          },
          {
            "name": "void"
          }
        ]
      }
    },
    {
      "name": "pathOrigin",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "ai"
          },
          {
            "name": "userDrawn"
          }
        ]
      }
    },
    {
      "name": "pathOutcome",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "pathIndex",
            "type": "u8"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "generationMethod",
            "type": {
              "defined": {
                "name": "pathOrigin"
              }
            }
          },
          {
            "name": "generationTimestamp",
            "type": "i64"
          },
          {
            "name": "predictedPrices",
            "docs": [
              "Predicted checkpoint prices stored on-chain (fixed-point u64, 6 decimals).",
              "Populated at path creation via add_path. Immutable after creation.",
              "Keepers read directly via index — no Merkle proofs needed."
            ],
            "type": {
              "vec": "u64"
            }
          },
          {
            "name": "numCheckpoints",
            "type": "u16"
          },
          {
            "name": "cumulativeAction",
            "docs": [
              "Cumulative action S = Σ[α(Δp)² + β(Δv)²] across checkpoints. Lower = better."
            ],
            "type": "u64"
          },
          {
            "name": "compositeScore",
            "docs": [
              "Final composite score (0 to 1_000_000). Set during settlement."
            ],
            "type": "u64"
          },
          {
            "name": "peakAmplitude",
            "docs": [
              "Highest amplitude this path reached (for decoherence payout ratio)"
            ],
            "type": "u64"
          },
          {
            "name": "amplitudeAtDecoherence",
            "docs": [
              "Amplitude when path was marked decohered (0 if still alive)"
            ],
            "type": "u64"
          },
          {
            "name": "dissolved",
            "type": "bool"
          },
          {
            "name": "dissolvedAtCheckpoint",
            "type": "u16"
          },
          {
            "name": "lastPredictedPrice",
            "type": "u64"
          },
          {
            "name": "lastActualPrice",
            "type": "u64"
          },
          {
            "name": "checkpointsProcessed",
            "docs": [
              "Number of checkpoints processed via check_dissolution (must equal",
              "total_checkpoints for score_path to accept this path)"
            ],
            "type": "u16"
          },
          {
            "name": "totalWagered",
            "type": "u64"
          },
          {
            "name": "totalLeveragedExposure",
            "type": "u64"
          },
          {
            "name": "lmsrSharesOutstanding",
            "type": "u64"
          },
          {
            "name": "totalTimeWeightedExposure",
            "docs": [
              "Time-weighted notional exposure: Σ(collateral × remaining_checkpoints / total_checkpoints).",
              "Accumulated at wager time. Used in ELF denominators so payout sums match distributable pool."
            ],
            "type": "u64"
          },
          {
            "name": "initialProbabilityBps",
            "type": "u16"
          },
          {
            "name": "currentImpliedProbability",
            "type": "u16"
          },
          {
            "name": "predQuadraticVariation",
            "docs": [
              "Predicted quadratic variation: Σ(pred_return_i²). Measures predicted path roughness."
            ],
            "type": "u64"
          },
          {
            "name": "actualQuadraticVariation",
            "docs": [
              "Actual quadratic variation: Σ(actual_return_i²). Ground truth path roughness."
            ],
            "type": "u64"
          },
          {
            "name": "predPeakPrice",
            "docs": [
              "Running peak of predicted prices (for drawdown tracking)."
            ],
            "type": "u64"
          },
          {
            "name": "predMaxDrawdown",
            "docs": [
              "Max drawdown of predicted path: max(peak - trough) / peak, fixed-point."
            ],
            "type": "u64"
          },
          {
            "name": "actualPeakPrice",
            "docs": [
              "Running peak of actual prices (for drawdown tracking)."
            ],
            "type": "u64"
          },
          {
            "name": "actualMaxDrawdown",
            "docs": [
              "Max drawdown of actual path: max(peak - trough) / peak, fixed-point."
            ],
            "type": "u64"
          },
          {
            "name": "firstPredictedPrice",
            "docs": [
              "First checkpoint's predicted price (for displacement feature)."
            ],
            "type": "u64"
          },
          {
            "name": "firstActualPrice",
            "docs": [
              "First checkpoint's actual price (for displacement feature)."
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
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "pathIndex",
            "type": "u8"
          },
          {
            "name": "collateral",
            "docs": [
              "Actual USDC deposited (after entry fee)"
            ],
            "type": "u64"
          },
          {
            "name": "leverage",
            "docs": [
              "1 for Mode 1; 2-50 for Mode 2"
            ],
            "type": "u8"
          },
          {
            "name": "notionalExposure",
            "docs": [
              "collateral × leverage"
            ],
            "type": "u64"
          },
          {
            "name": "lmsrShares",
            "docs": [
              "Shares held via LMSR pricing"
            ],
            "type": "u64"
          },
          {
            "name": "costBasis",
            "docs": [
              "Total USDC paid for shares (for P&L tracking)"
            ],
            "type": "u64"
          },
          {
            "name": "enteredAtCheckpoint",
            "type": "u16"
          },
          {
            "name": "borrowedAmount",
            "type": "u64"
          },
          {
            "name": "accruedBorrowFee",
            "type": "u64"
          },
          {
            "name": "healthFactor",
            "docs": [
              "Effective collateral / estimated loss (fixed-point 6 dec)"
            ],
            "type": "u64"
          },
          {
            "name": "liquidationThreshold",
            "docs": [
              "Health factor below which liquidation triggers (1_100_000 = 1.1)"
            ],
            "type": "u64"
          },
          {
            "name": "lastHealthUpdate",
            "type": "u16"
          },
          {
            "name": "partialPayoutClaimed",
            "type": "u64"
          },
          {
            "name": "finalPayout",
            "type": "u64"
          },
          {
            "name": "totalBorrowFeesPaid",
            "type": "u64"
          },
          {
            "name": "claimed",
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
      "name": "priceSample",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "checkpointIndex",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "price",
            "docs": [
              "Price in quote decimals (USDC = 6 decimals)"
            ],
            "type": "u64"
          },
          {
            "name": "confidence",
            "docs": [
              "Pyth confidence interval (normalized to 6 decimals)"
            ],
            "type": "u64"
          },
          {
            "name": "pythVerified",
            "docs": [
              "True — price was verified via Pyth Receiver Program (account owner check).",
              "The raw Pyth signature is verified upstream by the Pyth receiver; we don't",
              "store it on-chain (saves 64 bytes per checkpoint)."
            ],
            "type": "bool"
          },
          {
            "name": "sampledBy",
            "docs": [
              "Keeper address (for reward distribution)"
            ],
            "type": "pubkey"
          },
          {
            "name": "sampledAtSlot",
            "docs": [
              "Solana slot for ordering verification"
            ],
            "type": "u64"
          },
          {
            "name": "lowConfidence",
            "docs": [
              "True if confidence > 2% of price; weighted at 50% in scoring"
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
      "name": "protocolState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "insuranceFund",
            "type": "pubkey"
          },
          {
            "name": "leverageEnabled",
            "type": "bool"
          },
          {
            "name": "supportedPairs",
            "docs": [
              "Governance-managed pair whitelist"
            ],
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "tokenPair"
                  }
                },
                8
              ]
            }
          },
          {
            "name": "numSupportedPairs",
            "type": "u8"
          },
          {
            "name": "defaultFeeEntryBps",
            "type": "u16"
          },
          {
            "name": "defaultFeeSettleBps",
            "type": "u16"
          },
          {
            "name": "maxFeeCapBps",
            "docs": [
              "Hardcoded ceiling — not governable"
            ],
            "type": "u16"
          },
          {
            "name": "insuranceAllocationBps",
            "type": "u16"
          },
          {
            "name": "marketCreationFee",
            "docs": [
              "Market creation fee in USDC (6 decimals). Default 10_000_000 (10 USDC)."
            ],
            "type": "u64"
          },
          {
            "name": "season",
            "type": "u16"
          },
          {
            "name": "totalMarketsCreated",
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
      "name": "tokenPair",
      "docs": [
        "A whitelisted trading pair."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "quoteMint",
            "type": "pubkey"
          },
          {
            "name": "pythFeedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "active",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
