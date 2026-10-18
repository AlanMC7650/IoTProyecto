import 'package:flutter/material.dart';

import '../servicios/api.dart';
import 'login.dart';

class RegistroPantalla extends StatefulWidget {
  const RegistroPantalla({super.key});

  @override
  State<RegistroPantalla> createState() => _RegistroPantallaState();
}

class _RegistroPantallaState extends State<RegistroPantalla> {
  final _formulario = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _identificador = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _enviando = false;
  String? _error;

  Future<void> _registrar() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      // Al registrarse ya queda con la sesión iniciada y la app pasa a la lista
      await Api.instancia.registrar(
          _nombre.text.trim(), _identificador.text.trim(), _email.text.trim(), _password.text);
    } on ApiException catch (e) {
      setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  String? _obligatorio(String? v) => (v == null || v.trim().isEmpty) ? 'Campo obligatorio' : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crear cuenta')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formulario,
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  TextFormField(
                    controller: _nombre,
                    decoration: const InputDecoration(labelText: 'Nombre'),
                    validator: _obligatorio,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _identificador,
                    decoration: const InputDecoration(labelText: 'Identificador (CI o código)'),
                    validator: _obligatorio,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'Email'),
                    validator: (v) => (v == null || !v.contains('@')) ? 'Escribí un email válido' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Contraseña'),
                    validator: (v) => (v == null || v.length < 6) ? 'Mínimo 6 caracteres' : null,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    MensajeError(_error!),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _enviando ? null : _registrar,
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                    child: Text(_enviando ? 'Creando cuenta...' : 'Crear cuenta'),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
