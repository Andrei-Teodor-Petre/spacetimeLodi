// THIS FILE IS AUTOMATICALLY GENERATED BY SPACETIMEDB. EDITS TO THIS FILE
// WILL NOT BE SAVED. MODIFY TABLES IN YOUR MODULE SOURCE CODE INSTEAD.

/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
import {
  AlgebraicType,
  AlgebraicValue,
  BinaryReader,
  BinaryWriter,
  CallReducerFlags,
  ConnectionId,
  DbConnectionBuilder,
  DbConnectionImpl,
  DbContext,
  ErrorContextInterface,
  Event,
  EventContextInterface,
  Identity,
  ProductType,
  ProductTypeElement,
  ReducerEventContextInterface,
  SubscriptionBuilderImpl,
  SubscriptionEventContextInterface,
  SumType,
  SumTypeVariant,
  TableCache,
  TimeDuration,
  Timestamp,
  deepEqual,
} from "@clockworklabs/spacetimedb-sdk";
export type Package = {
  id: string,
  maxLoad: number,
  contents: string[],
  state: string,
  sourceDeposit: number,
  destinationDeposit: number,
};

/**
 * A namespace for generated helper functions.
 */
export namespace Package {
  /**
  * A function which returns this type represented as an AlgebraicType.
  * This function is derived from the AlgebraicType used to generate this type.
  */
  export function getTypeScriptAlgebraicType(): AlgebraicType {
    return AlgebraicType.createProductType([
      new ProductTypeElement("id", AlgebraicType.createStringType()),
      new ProductTypeElement("maxLoad", AlgebraicType.createU32Type()),
      new ProductTypeElement("contents", AlgebraicType.createArrayType(AlgebraicType.createStringType())),
      new ProductTypeElement("state", AlgebraicType.createStringType()),
      new ProductTypeElement("sourceDeposit", AlgebraicType.createU32Type()),
      new ProductTypeElement("destinationDeposit", AlgebraicType.createU32Type()),
    ]);
  }

  export function serialize(writer: BinaryWriter, value: Package): void {
    Package.getTypeScriptAlgebraicType().serialize(writer, value);
  }

  export function deserialize(reader: BinaryReader): Package {
    return Package.getTypeScriptAlgebraicType().deserialize(reader);
  }

}


