/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/levx.json`.
 */
export type Levx = {
  "address": "LEVXqi1Z2XujBw2jAEP15Dv8LyrDetDR95KZGGQNobV",
  "metadata": {
    "name": "levx",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptAuthority",
      "docs": [
        "F17 Step 2: the proposed pubkey signs to atomically swap itself into",
        "the authority slot and clear pending_authority."
      ],
      "discriminator": [
        107,
        86,
        198,
        91,
        33,
        12,
        107,
        160
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
          "name": "newAuthority",
          "docs": [
            "The previously-proposed pubkey, signing to accept the rotation."
          ],
          "signer": true
        }
      ],
      "args": []
    },
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
      "name": "appendPathChunk",
      "discriminator": [
        172,
        29,
        118,
        193,
        218,
        168,
        241,
        113
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
          "name": "pathUpload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  116,
                  104,
                  95,
                  117,
                  112,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "path_upload.creator",
                "account": "pathUpload"
              },
              {
                "kind": "account",
                "path": "path_upload.nonce",
                "account": "pathUpload"
              }
            ]
          }
        },
        {
          "name": "pathChunk",
          "writable": true
        },
        {
          "name": "relayer",
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
              "name": "appendPathChunkParams"
            }
          }
        }
      ]
    },
    {
      "name": "cancelPathUpload",
      "discriminator": [
        167,
        141,
        159,
        65,
        50,
        158,
        205,
        148
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
          "name": "pathUpload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  116,
                  104,
                  95,
                  117,
                  112,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "path_upload.nonce",
                "account": "pathUpload"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
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
          "name": "pathChunk",
          "docs": [
            "the current checkpoint. Legacy inline paths ignore this account."
          ]
        },
        {
          "name": "priceSample",
          "docs": [
            "The most recent PriceSample for this market.",
            "F19: `completed_checkpoints - 1` is safe because the `market` account",
            "constraint above rejects calls where completed_checkpoints == 0."
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
          "writable": true,
          "relations": [
            "market"
          ]
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
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "insuranceFund",
          "docs": [
            "Insurance fund — receives settlement rake share"
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
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
      "name": "closeAbandonedPathChunk",
      "discriminator": [
        60,
        128,
        12,
        11,
        122,
        24,
        104,
        183
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
          "name": "pathUpload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  116,
                  104,
                  95,
                  117,
                  112,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "path_upload.creator",
                "account": "pathUpload"
              },
              {
                "kind": "account",
                "path": "path_upload.nonce",
                "account": "pathUpload"
              }
            ]
          }
        },
        {
          "name": "pathChunk",
          "writable": true
        },
        {
          "name": "payer",
          "docs": [
            "Rent destination recorded when the relayer paid for this chunk."
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "closeMarket",
      "docs": [
        "Admin-only terminal cleanup. Closes a Settled/Void market once all",
        "positions have claimed/exited and the market vault is empty."
      ],
      "discriminator": [
        88,
        154,
        248,
        186,
        48,
        14,
        123,
        244
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
          "name": "vault",
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "authority",
          "docs": [
            "Protocol authority receives the reclaimed Market and vault rent."
          ],
          "writable": true,
          "signer": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "closePathChunk",
      "docs": [
        "F7: anyone closes a chunk backing a terminal-market PathOutcome.",
        "Rent returns to the relayer that paid for that chunk account."
      ],
      "discriminator": [
        191,
        169,
        29,
        181,
        225,
        214,
        25,
        83
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
          "name": "pathOutcome",
          "writable": true
        },
        {
          "name": "pathChunk",
          "writable": true
        },
        {
          "name": "payer",
          "docs": [
            "Rent destination recorded when the relayer paid for this chunk."
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "closePathOutcome",
      "docs": [
        "F7: the path's original creator closes a PathOutcome belonging to a",
        "Settled/Void market. Creator-only (NOT permissionless) to prevent",
        "griefing-DoS on unclaimed positions. Rent returns to the creator."
      ],
      "discriminator": [
        242,
        16,
        245,
        165,
        86,
        213,
        120,
        244
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
          "name": "pathOutcome",
          "writable": true
        },
        {
          "name": "creator",
          "docs": [
            "Rent destination recorded on PathOutcome. Permissionless after all",
            "positions are closed; the `has_one` constraint pins rent flow."
          ],
          "writable": true,
          "relations": [
            "pathOutcome"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "closePosition",
      "docs": [
        "F7: user closes their own claimed Position. Rent returns to the user."
      ],
      "discriminator": [
        123,
        134,
        81,
        0,
        49,
        68,
        98,
        98
      ],
      "accounts": [
        {
          "name": "market",
          "docs": [
            "Passed so the handler can reconstruct the Position PDA's original",
            "seeds (which use `market.market_id.to_le_bytes()` — 8 bytes, NOT the",
            "32-byte market pubkey). Market is self-authenticating via its own",
            "seed derivation, so a user can't supply a spoofed Market here."
          ],
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
          "name": "position",
          "writable": true
        },
        {
          "name": "user",
          "docs": [
            "Permissionless cleanup rent destination. Rent is returned only to the",
            "pubkey stored on the Position via `has_one = user`; no signer authority",
            "is granted by this account.",
            ""
          ],
          "writable": true,
          "relations": [
            "position"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "closePriceSample",
      "docs": [
        "F7: anyone closes a PriceSample belonging to a Settled/Void market.",
        "Permissionless — PriceSample isn't read post-settlement. Rent returns",
        "to the keeper that originally posted the sample."
      ],
      "discriminator": [
        8,
        4,
        73,
        10,
        57,
        38,
        32,
        46
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
                "kind": "account",
                "path": "price_sample.checkpoint_index",
                "account": "priceSample"
              }
            ]
          }
        },
        {
          "name": "sampledBy",
          "docs": [
            "Rent destination — the keeper that originally posted this sample.",
            "Permissionless: no post-settlement handler reads PriceSample, so",
            "there's no DoS risk from closing early. Any caller can trigger",
            "closure; the `constraint` above pins rent flow to the original keeper.",
            "PriceSample's `sampled_by` field doesn't match the Accounts field",
            "name, so we use an explicit constraint rather than `has_one`."
          ],
          "writable": true
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
          "name": "collateralMint",
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "insuranceFund",
          "docs": [
            "Insurance fund receives the market creation fee"
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
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
      "name": "createMarketGroup",
      "discriminator": [
        233,
        144,
        194,
        255,
        240,
        250,
        129,
        96
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
          "name": "marketGroup",
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
                  116,
                  95,
                  103,
                  114,
                  111,
                  117,
                  112
                ]
              },
              {
                "kind": "arg",
                "path": "params.group_key_hash"
              }
            ]
          }
        },
        {
          "name": "parentGroupAccount",
          "docs": [
            "Required only when `params.has_parent = true`."
          ],
          "optional": true
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
          "name": "params",
          "type": {
            "defined": {
              "name": "createMarketGroupParams"
            }
          }
        }
      ]
    },
    {
      "name": "createMarketUnderGroup",
      "discriminator": [
        4,
        164,
        242,
        92,
        18,
        19,
        182,
        38
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
          "name": "marketGroup",
          "docs": [
            "New child market creation is intentionally permissionless once a group is active.",
            "The group authority curates constraints and status; creators still pay normal fees."
          ],
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
                  116,
                  95,
                  103,
                  114,
                  111,
                  117,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "market_group.group_key_hash",
                "account": "marketGroup"
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
          "name": "marketGroupLink",
          "docs": [
            "The market_id-only link PDA makes group membership unique for each market."
          ],
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
                  116,
                  95,
                  103,
                  114,
                  111,
                  117,
                  112,
                  95,
                  108,
                  105,
                  110,
                  107
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
          "name": "collateralMint",
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "insuranceFund",
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "creatorTokenAccount",
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
      "name": "createPathUploadIntent",
      "discriminator": [
        134,
        103,
        225,
        100,
        213,
        126,
        166,
        147
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
          "name": "pathUpload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  116,
                  104,
                  95,
                  117,
                  112,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "params.nonce"
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
          "name": "params",
          "type": {
            "defined": {
              "name": "createPathUploadIntentParams"
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
          "name": "disputeConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "disputeBond",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101,
                  95,
                  98,
                  111,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "bondVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101,
                  95,
                  98,
                  111,
                  110,
                  100,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "collateralMint",
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "disputerTokenAccount",
          "writable": true
        },
        {
          "name": "disputer",
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
      "args": []
    },
    {
      "name": "exitPosition",
      "docs": [
        "`min_payout_out` — F4 slippage floor. Reverts with `SlippageExceeded`",
        "if the LMSR sell value net of settlement rake would be less than",
        "requested. Pass 0 to opt out."
      ],
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
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury — receives settlement rake share (same account as ProtocolState.treasury)"
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "insuranceFund",
          "docs": [
            "Insurance fund — receives settlement rake share"
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
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
      "args": [
        {
          "name": "minPayoutOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "finalizeDisputedMarketAfterTimeout",
      "discriminator": [
        33,
        34,
        168,
        27,
        175,
        212,
        104,
        126
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
          },
          "relations": [
            "disputeBond"
          ]
        },
        {
          "name": "disputeBond",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101,
                  95,
                  98,
                  111,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "bondVault",
          "writable": true
        },
        {
          "name": "collateralMint",
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "insuranceFund",
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "disputer",
          "writable": true
        },
        {
          "name": "cranker",
          "docs": [
            "Permissionless"
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
      "name": "finalizePathUpload",
      "discriminator": [
        169,
        147,
        126,
        26,
        243,
        140,
        120,
        122
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
          "name": "pathUpload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  116,
                  104,
                  95,
                  117,
                  112,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "market.market_id",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "path_upload.creator",
                "account": "pathUpload"
              },
              {
                "kind": "account",
                "path": "path_upload.nonce",
                "account": "pathUpload"
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
          "writable": true
        },
        {
          "name": "relayer",
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
      "name": "initializeDisputeConfig",
      "discriminator": [
        162,
        84,
        147,
        254,
        220,
        60,
        174,
        65
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
          "name": "disputeConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "protocolState"
          ]
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
              "name": "disputeConfigParams"
            }
          }
        }
      ]
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
      "name": "linkExistingMarketToGroup",
      "discriminator": [
        158,
        137,
        146,
        18,
        6,
        74,
        170,
        229
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
          "name": "marketGroup",
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
                  116,
                  95,
                  103,
                  114,
                  111,
                  117,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "market_group.group_key_hash",
                "account": "marketGroup"
              }
            ]
          }
        },
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
          "name": "marketGroupLink",
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
                  116,
                  95,
                  103,
                  114,
                  111,
                  117,
                  112,
                  95,
                  108,
                  105,
                  110,
                  107
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
      "name": "migrateMarketV2",
      "docs": [
        "One-time Market v1 -> v2 migration. Reallocs old market accounts by",
        "one byte and backfills `target_num_paths = MIN_TARGET_NUM_PATHS`."
      ],
      "discriminator": [
        53,
        150,
        38,
        89,
        165,
        103,
        103,
        59
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
          "docs": [
            "cannot deserialize. The handler validates owner, discriminator, and PDA."
          ],
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "migrateMarketV3",
      "docs": [
        "One-time Market v2 -> v3 migration. Reallocs old market accounts by",
        "two bytes and backfills `pricing_active_mask` from current amplitudes."
      ],
      "discriminator": [
        110,
        196,
        146,
        68,
        50,
        36,
        97,
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
          "docs": [
            "cannot deserialize. The handler validates owner, discriminator, and PDA."
          ],
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "migrateProtocolStateV2",
      "docs": [
        "One-time ProtocolState v1 → v2 migration. Appends the three new fields",
        "(pending_authority, collateral_mint, keeper_authority) and sets them to",
        "caller-supplied values. Admin-gated by protocol_state.authority AND by",
        "the hardcoded EXPECTED_DEPLOYER check (test-mode disables the latter).",
        "Safe to call exactly once per ProtocolState lifecycle."
      ],
      "discriminator": [
        219,
        187,
        36,
        138,
        164,
        173,
        246,
        18
      ],
      "accounts": [
        {
          "name": "protocolState",
          "docs": [
            "compiled `ProtocolState::INIT_SPACE` (v1 = 909 bytes vs v2 = 1006),",
            "so we can't use `Account<ProtocolState>` — Anchor's auto-deser fails",
            "before anything else runs. Anchor 0.31 also rejects `realloc` on",
            "`UncheckedAccount`. Solution: do the realloc manually inside the",
            "handler and validate ownership + discriminator + stored-authority",
            "there too. Canonical PDA derivation is still enforced by the",
            "`seeds`/`bump` attributes below."
          ],
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "collateralMint",
          "type": "pubkey"
        },
        {
          "name": "keeperAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "placeWager",
      "docs": [
        "`min_shares_out` — F4 slippage floor. Reverts with `SlippageExceeded`",
        "if LMSR quantities move between submit+land such that the caller would",
        "receive fewer shares than requested. Pass 0 to opt out."
      ],
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
          "writable": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury token account — receives 80% of entry fee"
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "insuranceFund",
          "docs": [
            "Insurance fund token account — receives 20% of entry fee"
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
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
        },
        {
          "name": "minSharesOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "proposeAuthority",
      "docs": [
        "F17 Step 1: current authority proposes a new authority. Stages the new",
        "pubkey in pending_authority; no effect on live authority yet."
      ],
      "discriminator": [
        20,
        148,
        236,
        198,
        76,
        119,
        99,
        142
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
          "signer": true,
          "relations": [
            "protocolState"
          ]
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "removeSupportedPair",
      "discriminator": [
        157,
        223,
        173,
        105,
        104,
        9,
        152,
        150
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
          "name": "index",
          "type": "u8"
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
          },
          "relations": [
            "disputeBond"
          ]
        },
        {
          "name": "disputeBond",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101,
                  95,
                  98,
                  111,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "bondVault",
          "writable": true
        },
        {
          "name": "collateralMint",
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "insuranceFund",
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "disputer",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "disputerTokenAccount",
          "docs": [
            "Required only when `uphold = true`."
          ],
          "writable": true,
          "optional": true
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
        "paths' decoherence in one transaction. Paths via remaining_accounts.",
        "This is the primary production sampling path (levx-infra keeper)."
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
      "name": "updateCollateralMint",
      "docs": [
        "F11 governance escape hatch: rotate the allowlisted collateral mint.",
        "Admin-only (has_one = authority). Required because migrate is",
        "one-shot — this gives us a recovery path for typos and a migration",
        "path if the canonical mint ever changes (e.g. USDC → USDG)."
      ],
      "discriminator": [
        191,
        190,
        143,
        38,
        133,
        195,
        254,
        65
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
          "signer": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "newCollateralMint",
          "docs": [
            "Validated by Anchor: must be owned by SPL Token program and decode",
            "as a real `Mint`. Rejects System Program pubkeys, token accounts,",
            "arbitrary data accounts."
          ]
        }
      ],
      "args": []
    },
    {
      "name": "updateDisputeConfig",
      "discriminator": [
        35,
        236,
        172,
        134,
        151,
        139,
        134,
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
          "name": "disputeConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "protocolState"
          ]
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "disputeConfigParams"
            }
          }
        }
      ]
    },
    {
      "name": "updateMarketGroupStatus",
      "discriminator": [
        39,
        39,
        13,
        146,
        44,
        179,
        222,
        162
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
          "name": "marketGroup",
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
                  116,
                  95,
                  103,
                  114,
                  111,
                  117,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "market_group.group_key_hash",
                "account": "marketGroup"
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
          "name": "status",
          "type": {
            "defined": {
              "name": "marketGroupStatus"
            }
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
      "name": "disputeBond",
      "discriminator": [
        52,
        102,
        115,
        175,
        111,
        220,
        8,
        79
      ]
    },
    {
      "name": "disputeConfig",
      "discriminator": [
        230,
        88,
        200,
        99,
        12,
        93,
        56,
        156
      ]
    },
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
      "name": "marketGroup",
      "discriminator": [
        131,
        205,
        141,
        87,
        148,
        210,
        33,
        36
      ]
    },
    {
      "name": "marketGroupLink",
      "discriminator": [
        10,
        255,
        47,
        3,
        133,
        34,
        79,
        96
      ]
    },
    {
      "name": "pathChunk",
      "discriminator": [
        71,
        157,
        141,
        211,
        63,
        203,
        119,
        32
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
      "name": "pathUpload",
      "discriminator": [
        182,
        42,
        6,
        64,
        186,
        185,
        204,
        127
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
  "events": [
    {
      "name": "abandonedPathChunkClosed",
      "discriminator": [
        123,
        222,
        215,
        129,
        189,
        103,
        115,
        175
      ]
    },
    {
      "name": "authorityAccepted",
      "discriminator": [
        166,
        192,
        219,
        188,
        41,
        209,
        195,
        26
      ]
    },
    {
      "name": "authorityProposed",
      "discriminator": [
        244,
        117,
        94,
        112,
        53,
        151,
        35,
        89
      ]
    },
    {
      "name": "checkpointSampled",
      "discriminator": [
        14,
        162,
        133,
        89,
        147,
        206,
        245,
        166
      ]
    },
    {
      "name": "claimPaid",
      "discriminator": [
        212,
        155,
        88,
        118,
        128,
        99,
        132,
        42
      ]
    },
    {
      "name": "collateralMintUpdated",
      "discriminator": [
        23,
        150,
        96,
        105,
        211,
        200,
        250,
        240
      ]
    },
    {
      "name": "disputeConfigUpdated",
      "discriminator": [
        231,
        168,
        142,
        115,
        107,
        235,
        60,
        4
      ]
    },
    {
      "name": "disputeRaised",
      "discriminator": [
        246,
        167,
        109,
        37,
        142,
        45,
        38,
        176
      ]
    },
    {
      "name": "disputeResolved",
      "discriminator": [
        121,
        64,
        249,
        153,
        139,
        128,
        236,
        187
      ]
    },
    {
      "name": "disputedMarketFinalized",
      "discriminator": [
        52,
        124,
        146,
        230,
        55,
        21,
        217,
        139
      ]
    },
    {
      "name": "eigendecompSubmitted",
      "discriminator": [
        225,
        21,
        145,
        189,
        95,
        225,
        155,
        42
      ]
    },
    {
      "name": "marketActivated",
      "discriminator": [
        196,
        73,
        78,
        48,
        187,
        132,
        107,
        11
      ]
    },
    {
      "name": "marketClosed",
      "discriminator": [
        86,
        91,
        119,
        43,
        94,
        0,
        217,
        113
      ]
    },
    {
      "name": "marketCreated",
      "discriminator": [
        88,
        184,
        130,
        231,
        226,
        84,
        6,
        58
      ]
    },
    {
      "name": "marketFinalized",
      "discriminator": [
        83,
        62,
        66,
        204,
        37,
        76,
        234,
        179
      ]
    },
    {
      "name": "marketGroupCreated",
      "discriminator": [
        245,
        171,
        234,
        186,
        92,
        62,
        15,
        221
      ]
    },
    {
      "name": "marketGroupStatusUpdated",
      "discriminator": [
        187,
        189,
        125,
        61,
        144,
        95,
        242,
        137
      ]
    },
    {
      "name": "marketLinkedToGroup",
      "discriminator": [
        75,
        251,
        245,
        71,
        24,
        189,
        117,
        153
      ]
    },
    {
      "name": "marketMigratedV2",
      "discriminator": [
        192,
        129,
        38,
        209,
        135,
        32,
        214,
        175
      ]
    },
    {
      "name": "marketMigratedV3",
      "discriminator": [
        174,
        211,
        10,
        2,
        68,
        197,
        3,
        199
      ]
    },
    {
      "name": "marketSettled",
      "discriminator": [
        237,
        212,
        22,
        175,
        201,
        117,
        215,
        99
      ]
    },
    {
      "name": "marketVoided",
      "discriminator": [
        217,
        12,
        138,
        39,
        108,
        75,
        89,
        26
      ]
    },
    {
      "name": "pathAdded",
      "discriminator": [
        190,
        15,
        221,
        10,
        151,
        77,
        232,
        7
      ]
    },
    {
      "name": "pathChunkAppended",
      "discriminator": [
        179,
        125,
        92,
        61,
        91,
        221,
        79,
        86
      ]
    },
    {
      "name": "pathChunkClosed",
      "discriminator": [
        25,
        253,
        137,
        206,
        228,
        233,
        8,
        136
      ]
    },
    {
      "name": "pathDissolved",
      "discriminator": [
        134,
        11,
        79,
        64,
        44,
        58,
        110,
        12
      ]
    },
    {
      "name": "pathOutcomeClosed",
      "discriminator": [
        185,
        94,
        201,
        142,
        115,
        12,
        61,
        119
      ]
    },
    {
      "name": "pathScored",
      "discriminator": [
        184,
        94,
        225,
        17,
        203,
        209,
        230,
        18
      ]
    },
    {
      "name": "pathUploadCancelled",
      "discriminator": [
        158,
        63,
        179,
        138,
        3,
        255,
        20,
        108
      ]
    },
    {
      "name": "pathUploadFinalized",
      "discriminator": [
        166,
        106,
        90,
        239,
        90,
        186,
        247,
        13
      ]
    },
    {
      "name": "pathUploadIntentCreated",
      "discriminator": [
        26,
        106,
        184,
        101,
        36,
        171,
        101,
        72
      ]
    },
    {
      "name": "positionClosed",
      "discriminator": [
        157,
        163,
        227,
        228,
        13,
        97,
        138,
        121
      ]
    },
    {
      "name": "positionExited",
      "discriminator": [
        157,
        47,
        238,
        226,
        42,
        152,
        228,
        17
      ]
    },
    {
      "name": "priceSampleClosed",
      "discriminator": [
        52,
        77,
        224,
        140,
        109,
        225,
        243,
        175
      ]
    },
    {
      "name": "protocolInitialized",
      "discriminator": [
        173,
        122,
        168,
        254,
        9,
        118,
        76,
        132
      ]
    },
    {
      "name": "protocolMigratedV2",
      "discriminator": [
        124,
        46,
        209,
        9,
        203,
        30,
        13,
        228
      ]
    },
    {
      "name": "supportedPairAdded",
      "discriminator": [
        91,
        137,
        12,
        204,
        73,
        156,
        85,
        248
      ]
    },
    {
      "name": "supportedPairRemoved",
      "discriminator": [
        132,
        157,
        47,
        93,
        176,
        229,
        92,
        94
      ]
    },
    {
      "name": "vaultInitialized",
      "discriminator": [
        180,
        43,
        207,
        2,
        18,
        71,
        3,
        75
      ]
    },
    {
      "name": "wagerPlaced",
      "discriminator": [
        11,
        99,
        79,
        96,
        254,
        4,
        72,
        11
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "insufficientPaths",
      "msg": "Market activation rejected; fewer than 3 paths registered"
    },
    {
      "code": 6001,
      "name": "marketNotStarted",
      "msg": "Market activation rejected; start_time has not been reached"
    },
    {
      "code": 6002,
      "name": "pathFreshnessExpired",
      "msg": "Market activation rejected; AI path exceeds freshness window"
    },
    {
      "code": 6003,
      "name": "maxPathsReached",
      "msg": "Maximum number of paths (16) reached"
    },
    {
      "code": 6004,
      "name": "targetPathCountOutOfRange",
      "msg": "Target path count must be between 3 and MAX_PATHS"
    },
    {
      "code": 6005,
      "name": "invalidMarketState",
      "msg": "Market is not in the expected state for this operation"
    },
    {
      "code": 6006,
      "name": "alreadyClaimed",
      "msg": "Position has already been claimed"
    },
    {
      "code": 6007,
      "name": "pathDissolved",
      "msg": "Cannot wager on dissolved path"
    },
    {
      "code": 6008,
      "name": "unauthorized",
      "msg": "Unauthorized signer for this operation"
    },
    {
      "code": 6009,
      "name": "checkpointMismatch",
      "msg": "Checkpoint count mismatch"
    },
    {
      "code": 6010,
      "name": "wagersNotAccepted",
      "msg": "Market is not accepting wagers in current state"
    },
    {
      "code": 6011,
      "name": "wagerTooSmall",
      "msg": "Wager amount too small or yields zero shares"
    },
    {
      "code": 6012,
      "name": "checkpointNotDue",
      "msg": "Checkpoint not yet due"
    },
    {
      "code": 6013,
      "name": "checkpointAlreadySampled",
      "msg": "Checkpoint already sampled"
    },
    {
      "code": 6014,
      "name": "oracleConfidenceTooLow",
      "msg": "Oracle confidence too low or price invalid"
    },
    {
      "code": 6015,
      "name": "tradingCutoffReached",
      "msg": "Trading window closed; market has passed 80% of checkpoints"
    },
    {
      "code": 6016,
      "name": "pathAlreadyDissolved",
      "msg": "Path has already been dissolved"
    },
    {
      "code": 6017,
      "name": "quantumStateCollapsed",
      "msg": "All path amplitudes collapsed to zero"
    },
    {
      "code": 6018,
      "name": "eigenNonConvergence",
      "msg": "Eigendecomposition did not converge within iteration limit"
    },
    {
      "code": 6019,
      "name": "eigenVerificationFailed",
      "msg": "Eigendecomposition verification failed: reconstruction error exceeds tolerance"
    },
    {
      "code": 6020,
      "name": "lambdaExceedsMax",
      "msg": "Lambda exceeds maximum allowed coupling strength"
    },
    {
      "code": 6021,
      "name": "nudgeRateExceedsMax",
      "msg": "Nudge rate exceeds maximum (500_000 = 50%)"
    },
    {
      "code": 6022,
      "name": "settlementIncomplete",
      "msg": "Settlement not complete; not all paths scored"
    },
    {
      "code": 6023,
      "name": "marketNotSettled",
      "msg": "Market not in Settled or Void state; cannot claim"
    },
    {
      "code": 6024,
      "name": "marketHasOpenPositions",
      "msg": "Market still has open positions; cannot close"
    },
    {
      "code": 6025,
      "name": "marketHasOpenPaths",
      "msg": "Market still has path outcomes; close paths and chunks first"
    },
    {
      "code": 6026,
      "name": "marketVaultNotEmpty",
      "msg": "Market vault is not empty; cannot close"
    },
    {
      "code": 6027,
      "name": "noSurvivingPaths",
      "msg": "No surviving paths to settle"
    },
    {
      "code": 6028,
      "name": "invalidScoringWeights",
      "msg": "Invalid scoring weights; must sum to 10000"
    },
    {
      "code": 6029,
      "name": "invalidPathIndex",
      "msg": "Invalid path index"
    },
    {
      "code": 6030,
      "name": "invalidProbability",
      "msg": "Initial probability must be in basis-point range [0, 10_000]"
    },
    {
      "code": 6031,
      "name": "pathNotYetActive",
      "msg": "Path is not active for wagering or scoring yet"
    },
    {
      "code": 6032,
      "name": "activePathWindowTooShort",
      "msg": "Not enough checkpoints remain for a live path"
    },
    {
      "code": 6033,
      "name": "invalidPathUpload",
      "msg": "Invalid path upload intent or chunk state"
    },
    {
      "code": 6034,
      "name": "pathUploadExpired",
      "msg": "Path upload intent has expired"
    },
    {
      "code": 6035,
      "name": "pathChunkMissing",
      "msg": "Path upload is missing one or more chunks"
    },
    {
      "code": 6036,
      "name": "pathRootMismatch",
      "msg": "Uploaded path chunks do not match the committed path root"
    },
    {
      "code": 6037,
      "name": "pathChunksNotClosed",
      "msg": "Path chunks must be closed before closing the path outcome"
    },
    {
      "code": 6038,
      "name": "relayFeeTooLow",
      "msg": "Relay fee is below the configured minimum"
    },
    {
      "code": 6039,
      "name": "unauthorizedRelayer",
      "msg": "Relay fee can only be claimed by the first chunk payer"
    },
    {
      "code": 6040,
      "name": "pathUploadExpiryTooLong",
      "msg": "Path upload expiry exceeds the maximum allowed age"
    },
    {
      "code": 6041,
      "name": "duplicateConfigAccount",
      "msg": "Treasury and insurance_fund must be distinct accounts"
    },
    {
      "code": 6042,
      "name": "alreadyMigrated",
      "msg": "ProtocolState has already been migrated to v2"
    },
    {
      "code": 6043,
      "name": "invalidCollateralMint",
      "msg": "Collateral mint does not match the protocol allowlist"
    },
    {
      "code": 6044,
      "name": "slippageExceeded",
      "msg": "Slippage exceeded: received fewer shares/less payout than min_out"
    },
    {
      "code": 6045,
      "name": "maturityNotElapsed",
      "msg": "Maturity window has not elapsed; cannot finalize"
    },
    {
      "code": 6046,
      "name": "marketDisputed",
      "msg": "Market is disputed; paused for governance review"
    },
    {
      "code": 6047,
      "name": "invalidDisputeConfig",
      "msg": "Invalid dispute bond policy or account"
    },
    {
      "code": 6048,
      "name": "invalidDisputeBond",
      "msg": "Invalid dispute bond account"
    },
    {
      "code": 6049,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6050,
      "name": "feeExceedsCap",
      "msg": "Fee exceeds maximum cap (5%)"
    },
    {
      "code": 6051,
      "name": "leverageNotEnabled",
      "msg": "Leverage is not enabled for this market"
    },
    {
      "code": 6052,
      "name": "leverageExceedsMaximum",
      "msg": "Leverage exceeds maximum for this market's timeframe"
    },
    {
      "code": 6053,
      "name": "vaultInsufficientCapacity",
      "msg": "Insufficient vault capacity for this leveraged position"
    },
    {
      "code": 6054,
      "name": "vaultUtilizationExceeded",
      "msg": "Vault utilization would exceed maximum after this borrow"
    },
    {
      "code": 6055,
      "name": "leveragedOiCapExceeded",
      "msg": "Market leveraged open interest cap would be exceeded"
    },
    {
      "code": 6056,
      "name": "positionUnderwater",
      "msg": "Position health factor below liquidation threshold"
    },
    {
      "code": 6057,
      "name": "positionHealthy",
      "msg": "Position health factor is above liquidation threshold; cannot liquidate"
    },
    {
      "code": 6058,
      "name": "unauthorizedBackstopLiquidator",
      "msg": "Caller is not the configured backstop liquidator"
    },
    {
      "code": 6059,
      "name": "backstopLiquidatorDisabled",
      "msg": "Backstop liquidator is disabled"
    },
    {
      "code": 6060,
      "name": "backstopGracePeriodActive",
      "msg": "Backstop grace period has not elapsed; regular keepers have priority"
    },
    {
      "code": 6061,
      "name": "bucketGuardCooldown",
      "msg": "Operation rate-limited; cooldown period has not elapsed"
    },
    {
      "code": 6062,
      "name": "invalidLmsrAlpha",
      "msg": "LMSR alpha is below the minimum supported value"
    },
    {
      "code": 6063,
      "name": "invalidMarketGroupConstraint",
      "msg": "Market group constraints reject this child market"
    },
    {
      "code": 6064,
      "name": "invalidMarketGroupStatus",
      "msg": "Market group is not active for new child markets"
    }
  ],
  "types": [
    {
      "name": "abandonedPathChunkClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "pathUpload",
            "type": "pubkey"
          },
          {
            "name": "chunkIndex",
            "type": "u8"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "rentRefunded",
            "type": "u64"
          }
        ]
      }
    },
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
      "name": "appendPathChunkParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "chunkIndex",
            "type": "u8"
          },
          {
            "name": "prices",
            "type": {
              "vec": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "authorityAccepted",
      "docs": [
        "F17 step 2. `previous` is the authority that existed before this tx."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previous",
            "type": "pubkey"
          },
          {
            "name": "new",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "authorityProposed",
      "docs": [
        "F17 step 1."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "current",
            "type": "pubkey"
          },
          {
            "name": "pending",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "checkpointSampled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "checkpointIndex",
            "type": "u16"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "confidence",
            "type": "u64"
          },
          {
            "name": "lowConfidence",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "claimPaid",
      "docs": [
        "Emitted by `claim` (sealed, Phase 6.2)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
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
            "name": "userPayout",
            "type": "u64"
          },
          {
            "name": "treasuryShare",
            "type": "u64"
          },
          {
            "name": "insuranceShare",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "collateralMintUpdated",
      "docs": [
        "F11 governance escape hatch."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "old",
            "type": "pubkey"
          },
          {
            "name": "new",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "createMarketGroupParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "groupKeyHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "parentGroup",
            "type": "pubkey"
          },
          {
            "name": "hasParent",
            "type": "bool"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "marketGroupKind"
              }
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "marketGroupStatus"
              }
            }
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
            "name": "constraintFlags",
            "type": "u8"
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
            "name": "allowedTimeframesMask",
            "type": "u32"
          },
          {
            "name": "metadataHash",
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
            "name": "targetNumPaths",
            "docs": [
              "Number of AI paths the internal generation pipeline should submit",
              "before the market can activate."
            ],
            "type": "u8"
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
          },
          {
            "name": "lmsrAlpha",
            "docs": [
              "LS-LMSR alpha (fixed-point 6 dec). `None` falls back to 1_000_000 (1.0).",
              "Values below 1.0 are rejected because they can drive normal first wagers",
              "into fixed-point softmax underflow."
            ],
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "createPathUploadIntentParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "pathRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
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
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "relayFeeLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "disputeBond",
      "docs": [
        "Per-market bond locked by the account that raised a dispute."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "disputer",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "reviewTimeoutAt",
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
      "name": "disputeConfig",
      "docs": [
        "Governance-managed dispute-bond policy.",
        "",
        "Kept in its own PDA so we can add bonded disputes without resizing the live",
        "ProtocolState account layout."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "minBondAmount",
            "docs": [
              "Minimum bond in the protocol collateral mint's base units."
            ],
            "type": "u64"
          },
          {
            "name": "bondBps",
            "docs": [
              "Market-pool percentage in basis points."
            ],
            "type": "u16"
          },
          {
            "name": "maxBondAmount",
            "docs": [
              "Maximum bond in the protocol collateral mint's base units."
            ],
            "type": "u64"
          },
          {
            "name": "reviewGracePeriod",
            "docs": [
              "Extra review period after maturity_end_time before timeout finalization."
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
      "name": "disputeConfigParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "minBondAmount",
            "type": "u64"
          },
          {
            "name": "bondBps",
            "type": "u16"
          },
          {
            "name": "maxBondAmount",
            "type": "u64"
          },
          {
            "name": "reviewGracePeriod",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeConfigUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "minBondAmount",
            "type": "u64"
          },
          {
            "name": "bondBps",
            "type": "u16"
          },
          {
            "name": "maxBondAmount",
            "type": "u64"
          },
          {
            "name": "reviewGracePeriod",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "disputeRaised",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "disputer",
            "type": "pubkey"
          },
          {
            "name": "bondAmount",
            "type": "u64"
          },
          {
            "name": "bondVault",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "disputeResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "upheld",
            "type": "bool"
          },
          {
            "name": "resolver",
            "type": "pubkey"
          },
          {
            "name": "bondAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "disputedMarketFinalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "finalizedAt",
            "type": "i64"
          },
          {
            "name": "disputer",
            "type": "pubkey"
          },
          {
            "name": "slashedBondAmount",
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
      "name": "eigendecompSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "keeper",
            "type": "pubkey"
          },
          {
            "name": "version",
            "type": "u64"
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
              "Alpha parameter for adaptive liquidity: b = α × Σ|q_j| (fixed-point 6 dec; default 1_000_000 = 1.0)"
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
            "name": "targetNumPaths",
            "docs": [
              "Required AI path count for activation. Configured at market creation."
            ],
            "type": "u8"
          },
          {
            "name": "numPaths",
            "type": "u8"
          },
          {
            "name": "numPositions",
            "docs": [
              "Open Position PDA count. Incremented by place_wager and decremented",
              "only when a claimed/exited Position account is closed, so terminal",
              "market cleanup cannot run while position accounts still exist."
            ],
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
          },
          {
            "name": "pricingActiveMask",
            "docs": [
              "Bit i is set when path i participates in pricing. This is the",
              "authoritative pricing liveness signal; amplitudes are probability state."
            ],
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "marketActivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "numPaths",
            "type": "u8"
          },
          {
            "name": "activatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "marketRentRefunded",
            "type": "u64"
          },
          {
            "name": "vaultRentRefunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "marketCreated",
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
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "endTime",
            "type": "i64"
          },
          {
            "name": "totalCheckpoints",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "marketFinalized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "finalizedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketGroup",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "groupKeyHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "parentGroup",
            "type": "pubkey"
          },
          {
            "name": "hasParent",
            "type": "bool"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "marketGroupKind"
              }
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "marketGroupStatus"
              }
            }
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
            "name": "constraintFlags",
            "type": "u8"
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
            "name": "allowedTimeframesMask",
            "type": "u32"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "childMarketCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "marketGroupCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "group",
            "type": "pubkey"
          },
          {
            "name": "groupKeyHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "parentGroup",
            "type": "pubkey"
          },
          {
            "name": "hasParent",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "marketGroupKind",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "root"
          },
          {
            "name": "league"
          },
          {
            "name": "season"
          },
          {
            "name": "game"
          },
          {
            "name": "event"
          },
          {
            "name": "assetSeason"
          },
          {
            "name": "horizon"
          },
          {
            "name": "custom"
          }
        ]
      }
    },
    {
      "name": "marketGroupLink",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "group",
            "docs": [
              "One group per market: this account's PDA is keyed by market_id only."
            ],
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "timeframeSeconds",
            "type": "u32"
          },
          {
            "name": "linkedAt",
            "type": "i64"
          },
          {
            "name": "groupKind",
            "type": {
              "defined": {
                "name": "marketGroupKind"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reserved",
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
      "name": "marketGroupStatus",
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "paused"
          },
          {
            "name": "retired"
          }
        ]
      }
    },
    {
      "name": "marketGroupStatusUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "group",
            "type": "pubkey"
          },
          {
            "name": "oldStatus",
            "type": "u8"
          },
          {
            "name": "newStatus",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "marketLinkedToGroup",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "group",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "groupKind",
            "type": "u8"
          },
          {
            "name": "timeframeSeconds",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "marketMigratedV2",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "targetNumPaths",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketMigratedV3",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "pricingActiveMask",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "marketSettled",
      "docs": [
        "Emitted by `settle_market` (sealed, Phase 6.3) when settling transitions",
        "Settling → Maturing or Settling → Settled (all-dissolved)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "pathsScored",
            "type": "u8"
          },
          {
            "name": "pathsDissolved",
            "type": "u8"
          },
          {
            "name": "totalPool",
            "type": "u64"
          },
          {
            "name": "partialPayoutsDistributed",
            "type": "u64"
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
      "name": "marketVoided",
      "docs": [
        "Emitted by both oracle-triggered `void_market` and admin `void_market_governance`.",
        "`reason`: 0 = oracle skip threshold exceeded, 1 = governance emergency."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pathAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
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
            "name": "origin",
            "docs": [
              "0 = Ai, 1 = UserDrawn (matches `PathOrigin` enum ordering)."
            ],
            "type": "u8"
          },
          {
            "name": "generationTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pathChunk",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "pathUpload",
            "type": "pubkey"
          },
          {
            "name": "chunkIndex",
            "type": "u8"
          },
          {
            "name": "len",
            "type": "u8"
          },
          {
            "name": "prices",
            "type": {
              "array": [
                "u64",
                40
              ]
            }
          },
          {
            "name": "chunkHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "pathChunkAppended",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "pathUpload",
            "type": "pubkey"
          },
          {
            "name": "chunkIndex",
            "type": "u8"
          },
          {
            "name": "len",
            "type": "u8"
          },
          {
            "name": "payer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "pathChunkClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "pathIndex",
            "type": "u8"
          },
          {
            "name": "chunkIndex",
            "type": "u8"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "rentRefunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pathDissolved",
      "docs": [
        "Emitted by `sample_and_dissolve` (sealed, Phase 6.4), once per path",
        "that transitions to `dissolved == true` inside the batch."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "pathIndex",
            "type": "u8"
          },
          {
            "name": "atCheckpoint",
            "type": "u16"
          },
          {
            "name": "partialPayout",
            "type": "u64"
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
            "name": "pathUpload",
            "docs": [
              "Upload intent that committed this path's chunk data.",
              "Legacy/direct paths use Pubkey::default()."
            ],
            "type": "pubkey"
          },
          {
            "name": "pathRoot",
            "docs": [
              "Commitment over every uploaded chunk. Empty for legacy/direct paths."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "chunkCount",
            "docs": [
              "Number of PathChunk PDAs backing this path. Zero means legacy inline prices."
            ],
            "type": "u8"
          },
          {
            "name": "chunksClosed",
            "docs": [
              "Terminal cleanup counter. close_path_outcome requires this to reach chunk_count."
            ],
            "type": "u8"
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
              "Legacy/direct checkpoint prices. New high-checkpoint paths store prices",
              "in PathChunk PDAs and leave this Vec empty."
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
            "name": "createdAtCheckpoint",
            "docs": [
              "Checkpoint count when this path was created. Pending-created paths use 0."
            ],
            "type": "u16"
          },
          {
            "name": "firstActiveCheckpoint",
            "docs": [
              "First checkpoint index this path is eligible to score/wager against."
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
            "name": "currentImpliedProbability",
            "type": "u16"
          },
          {
            "name": "initialAmplitude",
            "docs": [
              "Amplitude assigned when the path first became active."
            ],
            "type": "u64"
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
      "name": "pathOutcomeClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
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
            "name": "rentRefunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pathScored",
      "docs": [
        "Emitted by `score_path` (sealed, Phase 6.5)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "pathIndex",
            "type": "u8"
          },
          {
            "name": "compositeScore",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pathUpload",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
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
            "name": "initialProbabilityBps",
            "type": "u16"
          },
          {
            "name": "numCheckpoints",
            "type": "u16"
          },
          {
            "name": "chunkCount",
            "type": "u8"
          },
          {
            "name": "chunksWrittenMask",
            "type": "u16"
          },
          {
            "name": "chunksClosedMask",
            "type": "u16"
          },
          {
            "name": "pathRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "relayFeeLamports",
            "type": "u64"
          },
          {
            "name": "finalized",
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
      "name": "pathUploadCancelled",
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
            "name": "pathUpload",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pathUploadFinalized",
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
            "name": "pathUpload",
            "type": "pubkey"
          },
          {
            "name": "pathIndex",
            "type": "u8"
          },
          {
            "name": "relayFeeLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "pathUploadIntentCreated",
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
            "name": "pathUpload",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "chunkCount",
            "type": "u8"
          },
          {
            "name": "numCheckpoints",
            "type": "u16"
          },
          {
            "name": "relayFeeLamports",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
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
      "name": "positionClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
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
            "name": "rentRefunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "positionExited",
      "docs": [
        "Phase 7: F4 + F9 rework. `user_payout` is the post-rake amount sent to",
        "the user; `treasury_share` + `insurance_share` together are the",
        "settlement rake (same 90/10 split as `ClaimPaid`). For a pre-settlement",
        "exit in a healthy market, both rake shares are non-zero; for edge cases",
        "where `payout == 0` all three are zero."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
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
            "name": "userPayout",
            "type": "u64"
          },
          {
            "name": "treasuryShare",
            "type": "u64"
          },
          {
            "name": "insuranceShare",
            "type": "u64"
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
            "name": "sampledBy",
            "docs": [
              "Keeper address (for reward distribution). Pyth verification is enforced",
              "upstream by the Pyth Receiver program's account owner constraint — no",
              "per-sample flag stored on-chain."
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
      "name": "priceSampleClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
          },
          {
            "name": "checkpointIndex",
            "type": "u16"
          },
          {
            "name": "sampledBy",
            "type": "pubkey"
          },
          {
            "name": "rentRefunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "protocolInitialized",
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
          }
        ]
      }
    },
    {
      "name": "protocolMigratedV2",
      "docs": [
        "F11 foundation (Phase 2). Emitted once at v1→v2 migrate."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "keeperAuthority",
            "type": "pubkey"
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
          },
          {
            "name": "pendingAuthority",
            "docs": [
              "F17: pending authority for the two-step rotation pattern. Set by",
              "`propose_authority` from the current authority; consumed by",
              "`accept_authority` which must be signed by the proposed key.",
              "Zero-initialized (`None`) immediately after migrate."
            ],
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "collateralMint",
            "docs": [
              "F11: the sole mint accepted as collateral by `create_market`. Stops",
              "attacker-run \"shadow markets\" that pair real fees with a fake mint.",
              "Zero-initialized to `Pubkey::default()` immediately after migrate;",
              "must be set to the production USDC mint before F11 lands."
            ],
            "type": "pubkey"
          },
          {
            "name": "keeperAuthority",
            "docs": [
              "F21: pubkey authorized to call `add_path` with",
              "`generation_method = PathOrigin::Ai`. User-drawn paths remain",
              "permissionless. Zero-initialized to `Pubkey::default()` immediately",
              "after migrate; must be set to the infra keeper pubkey before F21",
              "lands."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "supportedPairAdded",
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
          }
        ]
      }
    },
    {
      "name": "supportedPairRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "index",
            "docs": [
              "Original index of the pair that was removed."
            ],
            "type": "u8"
          },
          {
            "name": "newNumSupportedPairs",
            "docs": [
              "`num_supported_pairs` after the removal — equivalent to the",
              "pre-removal index of the entry that was swapped into `index`."
            ],
            "type": "u8"
          },
          {
            "name": "baseMint",
            "docs": [
              "The pair that was removed (sourced from the original slot at",
              "`index` before the swap-remove ran)."
            ],
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
            "name": "replacementBaseMint",
            "docs": [
              "The pair that moved into `index` as part of swap-remove. When",
              "`index == new_num_supported_pairs` the swap was a no-op (the",
              "removed entry was already the last one); in that case this",
              "field is `TokenPair::default()` so consumers can short-circuit",
              "without re-reading state."
            ],
            "type": "pubkey"
          },
          {
            "name": "replacementQuoteMint",
            "type": "pubkey"
          },
          {
            "name": "replacementPythFeedId",
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
    },
    {
      "name": "vaultInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "wagerPlaced",
      "docs": [
        "Emitted by `place_wager` (sealed, Phase 6.1)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketId",
            "type": "u64"
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
            "type": "u64"
          },
          {
            "name": "shares",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
