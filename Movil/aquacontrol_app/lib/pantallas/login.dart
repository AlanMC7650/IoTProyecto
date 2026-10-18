import 'package:flutter/material.dart';

import '../servicios/api.dart';
import '../servicios/sesion.dart';
import '../tema.dart';
import 'registro.dart';

class LoginPantalla extends StatefulWidget {
  const LoginPantalla({super.key});

  @override
  State<LoginPantalla> createState() => _LoginPantallaState();
}

class _LoginPantallaState extends State<LoginPantalla> {
  final _formulario = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _enviando = false;
  String? _error;

  Future<void> _ingresar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      // Si sale bien, la sesión avisa y la app pasa sola a la lista de dispositivos
      await Api.instancia.login(_email.text.trim(), _password.text);
    } on ApiException catch (e) {
      setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formulario,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Marca(subtitulo: 'Iniciá sesión para ver tus dispositivos'),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
                      validator: (v) => (v == null || !v.contains('@')) ? 'Escribí tu email' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _password,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Contraseña', prefixIcon: Icon(Icons.lock_outline)),
                      validator: (v) => (v == null || v.length < 6) ? 'Mínimo 6 caracteres' : null,
                      onFieldSubmitted: (_) => _ingresar(),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      MensajeError(_error!),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _enviando ? null : _ingresar,
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                      child: Text(_enviando ? 'Ingresando...' : 'Ingresar'),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => Navigator.of(context)
                          .push(MaterialPageRoute(builder: (_) => const RegistroPantalla())),
                      child: const Text('¿No tenés cuenta? Registrate'),
                    ),
                    const SizedBox(height: 18),
                    const SelectorServidor(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Marca extends StatelessWidget {
  final String subtitulo;
  const _Marca({required this.subtitulo});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Container(
        width: 60,
        height: 60,
        decoration: BoxDecoration(color: colorPrimario, borderRadius: BorderRadius.circular(16)),
        child: const Icon(Icons.water_drop, color: Colors.white, size: 32),
      ),
      const SizedBox(height: 14),
      Text('AquaControl', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      Text(subtitulo, style: const TextStyle(color: colorTextoSuave), textAlign: TextAlign.center),
    ]);
  }
}

class MensajeError extends StatelessWidget {
  final String texto;
  const MensajeError(this.texto, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFFEBEE), borderRadius: BorderRadius.circular(10)),
      child: Text(texto, style: const TextStyle(color: Color(0xFFC62828))),
    );
  }
}

// Dirección del Back. Por defecto es el dominio de ngrok del equipo; se puede
// cambiar, por ejemplo, a la IP de la PC si el celular está en la misma red.
class SelectorServidor extends StatefulWidget {
  const SelectorServidor({super.key});

  @override
  State<SelectorServidor> createState() => _SelectorServidorState();
}

class _SelectorServidorState extends State<SelectorServidor> {
  final _sesion = Sesion.instancia;

  Future<void> _editar() async {
    final control = TextEditingController(text: _sesion.servidor);
    final nuevo = await showDialog<String>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Servidor'),
        content: TextField(
          controller: control,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(helperText: 'Ej: https://tu-dominio.ngrok-free.dev'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(contexto), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(contexto, control.text), child: const Text('Guardar')),
        ],
      ),
    );
    if (nuevo != null && nuevo.trim().startsWith('http')) {
      await _sesion.cambiarServidor(nuevo);
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: _editar,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.dns_outlined, size: 16, color: colorTextoSuave),
          const SizedBox(width: 6),
          Flexible(
            child: Text('Servidor: ${_sesion.servidor}',
                style: const TextStyle(color: colorTextoSuave, fontSize: 12), overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.edit, size: 14, color: colorTextoSuave),
        ]),
      ),
    );
  }
}
