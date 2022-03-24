import * as ast from "../core/ast/index.ts";
import { parse } from "../core/parser/proto.ts";
import { filterNodesByType } from "../core/schema/ast-util.ts";
import { getDescription, getOptions, getRpcs } from "../core/schema/builder.ts";
import { Service } from "../core/schema/model.ts";

export function* iterServices(
  statements: ast.Statement[],
  typePath: string,
  filePath: string,
): Generator<[string, Service]> {
  const serviceStatements = filterNodesByType(statements, "service" as const);
  for (const statement of serviceStatements) {
    const serviceTypePath = typePath + "." + statement.serviceName.text;
    const service: Service = {
      filePath,
      options: getOptions(statement.serviceBody.statements),
      description: getDescription(statement.leadingComments),
      rpcs: getRpcs(statement.serviceBody.statements),
    };
    yield [serviceTypePath, service];
  }
}

const printMethod = () => {
};

const printTypescript = (ast: ast.Proto, options?: any) => {
  // printMethod(ast.statements)
  const services = iterServices(ast.statements, "", "1.proto");
  const strs: string[] = [];
  for (const [typePath, service] of services) {
    // for (const rpcName in service.rpcs) {
    //   const rpc = service.rpcs[rpcName];
    //   rpc.reqType.type;
    // }
    // const requestType = requestType === EMPTY
    //   ? ""
    //   : `params: ${param.requestType}`;
    // const responseType = param.responseType === EMPTY
    //   ? "{}"
    //   : param.responseType;

    // const prefix = options.isDefinition ? "" : "export ";
    // return (
    //   `${prefix}interface ${param.name} {\n` +
    //   `  (${requestType}): Promise<${responseType}>;\n` +
    //   `}\n` +
    //   `\n`
    // );

    // return `${strs.join("")}`;
  }
};

printTypescript(
  parse(`
syntax = "proto3";

// aa
service MyService {
    // bbb
    rpc MyMethod (MyRequest) returns (MyResponse); // ccc
}

message MyRequest {
    string path = 1;
}

message MyResponse {
    int32 status = 1;
}
`).ast,
);
