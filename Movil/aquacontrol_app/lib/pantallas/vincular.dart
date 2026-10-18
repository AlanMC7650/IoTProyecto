import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../servicios/api.dart';
import '../tema.dart';
import 'login.dart';

// Vincular un ESP32 con el código de 6 caracteres que muestra al encenderse
// (las últimas cifras de su MAC, también en el nombre de su red AquaControl-XXXXXX).
class VincularPantalla extends StatefulWidget {
  const VincularPantalla({super.key});

  @override
  State<VincularPantalla> createState() => _VincularPantallaState();
}

class _VincularPantallaState extends State<VincularPantalla> {
  final _formulario = GlobalKey<FormState>();
  final _codigo = TextEditingController();
  final _nombre = TextEditingController();
  bool _enviando = false;
  String? _error;

  Future<void> _vincular() async {
    if (!_formulario.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      final d = await Api.instancia.vincular(_codigo.text.trim().toUpperCase(), _nombre.text.trim());
      if (mounted) Navigator.of(context).pop(d);
    } on ApiException catch (e) {
      setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Vincular dispositivo')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formulario,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _Paso(1, 'Conectá el ESP32 a tu Wi-Fi. La primera vez crea la red AquaControl-XXXXXX: '
                        'conectate con el celular, abrí http://192.168.4.1 y escribí la contraseña de tu Wi-Fi.'),
                    _Paso(2, 'Esperá que el LED parpadee en azul: está esperando que lo vincules.'),
                    _Paso(3, 'Escribí acá su código (las 6 letras y números de AquaControl-XXXXXX) y un nombre.'),
                  ]),
                ),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _codigo,
                textCapitalization: TextCapitalization.characters,
                autocorrect: false,
                maxLength: 6,
                style: const TextStyle(fontFamily: 'monospace', letterSpacing: 6, fontSize: 20),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp('[0-9a-fA-F]')),
                  TextInputFormatter.withFunction(
                      (_, nuevo) => nuevo.copyWith(text: nuevo.text.toUpperCase())),
                ],
                decoration: const InputDecoration(labelText: 'Código', hintText: '3F2A1B'),
                validator: (v) => (v == null || v.length != 6) ? 'El código tiene 6 caracteres' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _nombre,
                maxLength: 100,
                decoration: const InputDecoration(labelText: 'Nombre', hintText: 'Cocina'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Ponele un nombre' : null,
              ),
              if (_error != null) ...[const SizedBox(height: 8), MensajeError(_error!)],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _enviando ? null : _vincular,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(_enviando ? 'Vinculando...' : 'Vincular'),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Paso extends StatelessWidget {
  final int numero;
  final String texto;
  const _Paso(this.numero, this.texto);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        CircleAvatar(
          radius: 11,
          backgroundColor: colorPrimario,
          child: Text('$numero', style: const TextStyle(color: Colors.white, fontSize: 12)),
        ),
        const SizedBox(width: 10),
        Expanded(child: Text(texto)),
      ]),
    );
  }
}
