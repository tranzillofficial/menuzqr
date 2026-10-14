import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import qz.auth.Certificate;
class VerifyMenuzQR {
  public static void main(String[] args) throws Exception {
    Certificate certificate = new Certificate(new String(Files.readAllBytes(Paths.get(args[0])), StandardCharsets.UTF_8));
    if (!certificate.isTrusted() || !certificate.isSaved() || certificate.isBlocked()) throw new Exception("MenuzQR certificate is not trusted and allowed");
    String request = new String(Files.readAllBytes(Paths.get(args[1])), StandardCharsets.UTF_8);
    String signature = new String(Files.readAllBytes(Paths.get(args[2])), StandardCharsets.UTF_8).trim();
    if (!certificate.isSignatureValid(Certificate.Algorithm.SHA512, signature, request)) throw new Exception("MenuzQR server signature rejected");
    if (certificate.isSignatureValid(Certificate.Algorithm.SHA512, signature, request + " ")) throw new Exception("Tampered request accepted");
    System.out.println("MenuzQR trusted signing verified by QZ 2.1.6 x86");
  }
}
