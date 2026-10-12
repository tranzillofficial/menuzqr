declare module 'qz-tray' {
 const qz:{websocket:{isActive():boolean;connect():Promise<void>};printers:{find():Promise<string[]>;getDefault():Promise<string>};configs:{create(printer:string,options:Record<string,unknown>):unknown};print(config:unknown,data:unknown[]):Promise<void>};
 export default qz;
}
