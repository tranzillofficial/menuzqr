export async function resolve(specifier,context,next){
 if(specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier)){
  try{return await next(specifier+'.ts',context);}catch{}
 }
 return next(specifier,context);
}
