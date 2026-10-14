import {QZ_CERTIFICATE} from './qz-certificate';
let connecting: Promise<void> | null = null;
let configured = false;
export async function qzConnection() {
  const {default:qz} = await import('qz-tray');
  if (!configured) {
    qz.security.setCertificatePromise(resolve => resolve(QZ_CERTIFICATE));
    qz.security.setSignatureAlgorithm('SHA512');
    // Delegate hashing to the server so it can validate the full operation before
    // signing. QZ only passes this callback's result to setSignaturePromise.
    qz.api.setSha256Type((message: string) => message);
    qz.security.setSignaturePromise((message: string) => async (resolve, reject) => {
      try {
        const response = await fetch('/api/printing/sign', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'text/plain'}, body:message, cache:'no-store'});
        if (!response.ok) throw new Error(await response.text());
        resolve(await response.text());
      } catch (error) { reject(error); }
    });
    configured = true;
  }
  if (!qz.websocket.isActive()) {
    if (!connecting) connecting = qz.websocket.connect().finally(() => {connecting = null;});
    await connecting;
  }
  return qz;
}
