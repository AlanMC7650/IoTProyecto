// En Android se usa el cliente normal de package:http. En el navegador (para
// probar la app en Chrome) hace falta FetchClient, porque el cliente web por
// defecto espera a que termine la respuesta y el tiempo real (SSE) no termina nunca.
export 'cliente_http_io.dart' if (dart.library.js_interop) 'cliente_http_web.dart';
