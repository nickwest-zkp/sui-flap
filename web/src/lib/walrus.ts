import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { walrus, WalrusFile } from "@mysten/walrus";

const WALRUS_UPLOAD_RELAY = "https://upload-relay.testnet.walrus.space";

export function createWalrusClient() {
  return new SuiJsonRpcClient({
    network: "testnet",
    url: "https://fullnode.testnet.sui.io:443",
  }).$extend(
    walrus({
      wasmUrl: "https://unpkg.com/@mysten/walrus-wasm@0.2.2/web/walrus_wasm_bg.wasm",
      uploadRelay: {
        host: WALRUS_UPLOAD_RELAY,
        sendTip: {
          max: 1_000_000,
        },
      },
    }),
  );
}

export function walrusTextFile(name: string, contents: string) {
  return walrusBinaryFile(name, new TextEncoder().encode(contents), "text/plain");
}

export function walrusBinaryFile(name: string, contents: Uint8Array, contentType: string) {
  return WalrusFile.from({
    contents,
    identifier: name,
    tags: {
      "content-type": contentType,
    },
  });
}

export function walrusJsonFile(name: string, json: unknown) {
  return walrusBinaryFile(name, new TextEncoder().encode(JSON.stringify(json)), "application/json");
}
