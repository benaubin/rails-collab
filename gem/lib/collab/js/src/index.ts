import schemaFunctions from "./prosemirror";

export type JSONSerializable = { [key: string]: unknown };

function isKeyOf<T extends {}>(
  key: string | symbol | number,
  obj: T
): key is keyof T {
  return obj.hasOwnProperty(key);
}

const schemaFunctionsCache: Record<
  string,
  Record<string, ReturnType<typeof schemaFunctions>>
> = {};

function getSchemaFunctions(schemaPackage: string, schemaName: string) {
  if (schemaFunctionsCache[schemaPackage] == null)
    schemaFunctionsCache[schemaPackage] = {};

  if (schemaFunctionsCache[schemaPackage][schemaName] == null)
    schemaFunctionsCache[schemaPackage][schemaName] = schemaFunctions(
      require(schemaPackage)[schemaName]
    );

  return schemaFunctionsCache[schemaPackage][schemaName];
}

function onLine(line: string) {
  let response:
    | {
        error: Error;
      }
    | {
        result: JSONSerializable;
      };

  try {
    const { name, data, schemaPackage, schemaName } = JSON.parse(line);

    const rpc = getSchemaFunctions(schemaPackage, schemaName);

    if (isKeyOf(name, rpc)) {
      const handler = rpc[name] as (data: JSONSerializable) => JSONSerializable;
      response = { result: handler(data) };
    } else {
      response = {
        error: {
          name: "InvalidRPC",
          message: "Don't know how to process call with name '" + name + "'",
        },
      };
    }
  } catch (e) {
    response = {
      error: {
        name: e.name,
        message: e.message,
        stack: e.stack,
      },
    };
  }

  console.log(JSON.stringify(response));
}

const newline = "\n".charCodeAt(0);

let buffers: Buffer[] = [];

process.stdin.on("data", (data) => {
  let start = 0,
    i = 0;

  for (; i < data.byteLength; i++) {
    if (data[i] === newline) {
      buffers.push(data.slice(start, i));
      onLine(buffers.reduce((str, buf) => str + buf.toString("utf-8"), ""));
      buffers = [];
      start = i + 1;
    }
  }
  if (start < i) {
    buffers.push(data.slice(start, i));
  }
});
