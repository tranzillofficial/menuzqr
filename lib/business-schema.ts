type SchemaError={code?:string;message?:string}|null;
export function businessSchemaMissing(error:SchemaError):boolean {
 return !!error&&['42P01','42703','PGRST202','PGRST204','PGRST205'].includes(error.code??'')&&/business_types|business_type_id|business_configuration_overrides|configure_business/.test(error.message??'');
}
