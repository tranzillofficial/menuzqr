declare module 'qz-tray' {
 type Resolver = (value:string)=>void;
 type Rejecter = (error:unknown)=>void;
 const qz:{api:{setSha256Type(hasher:(message:string)=>string):void};security:{setCertificatePromise(callback:(resolve:Resolver,reject:Rejecter)=>void):void;setSignatureAlgorithm(algorithm:string):void;setSignaturePromise(callback:(message:string)=>(resolve:Resolver,reject:Rejecter)=>void):void};websocket:{isActive():boolean;connect():Promise<void>};printers:{find():Promise<string[]>;getDefault():Promise<string>};configs:{create(printer:string,options:Record<string,unknown>):unknown};print(config:unknown,data:unknown[]):Promise<void>};
 export default qz;
}
