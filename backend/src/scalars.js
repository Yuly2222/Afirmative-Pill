import { GraphQLScalarType, GraphQLError, Kind } from 'graphql';

const fail = (message) => { throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } }); };

export const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'Fecha-hora ISO-8601 (UTC).',
  serialize: (value) => new Date(value).toISOString(),
  parseValue(value) {
    const date = new Date(value);
    if (typeof value !== 'string' || Number.isNaN(date.getTime())) fail(`DateTime inválido: ${value}`);
    return date;
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) fail('DateTime debe ser un string ISO-8601');
    return DateTime.parseValue(ast.value);
  },
});

function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) fail(`Money inválido: ${value}`);
  return Math.round(n * 100) / 100;
}

export const Money = new GraphQLScalarType({
  name: 'Money',
  description: 'Pesos colombianos (COP), no negativo, 2 decimales.',
  serialize: toMoney,
  parseValue: toMoney,
  parseLiteral: (ast) => (ast.kind === Kind.INT || ast.kind === Kind.FLOAT ? toMoney(ast.value) : fail('Money debe ser numérico')),
});

function toPositiveInt(value) {
  if (!Number.isInteger(value) || value <= 0) fail(`PositiveInt inválido: ${value}. Debe ser un entero > 0`);
  return value;
}

export const PositiveInt = new GraphQLScalarType({
  name: 'PositiveInt',
  description: 'Entero mayor que cero.',
  serialize: toPositiveInt,
  parseValue: toPositiveInt,
  parseLiteral: (ast) => (ast.kind === Kind.INT ? toPositiveInt(Number(ast.value)) : fail('PositiveInt debe ser entero')),
});
