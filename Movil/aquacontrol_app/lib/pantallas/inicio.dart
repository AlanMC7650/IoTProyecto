import 'package:flutter/material.dart';

import '../modelos.dart';
import '../servicios/api.dart';
import '../servicios/sesion.dart';
import '../tema.dart';
import 'dispositivo.dart';
import 'login.dart';
import 'vincular.dart';

// Lista de dispositivos del usuario. Se actualiza al entrar, al volver de un
// dispositivo y deslizando hacia abajo (cada pedido pasa por ngrok, así que no
// se consulta sola cada pocos segundos).
class InicioPantalla extends StatefulWidget {
  const InicioPantalla({super.key});

  @override
  State<InicioPantalla> createState() => _InicioPantallaState();
}

class _InicioPantallaState extends State<InicioPantalla> {
  List<Dispositivo>? _dispositivos;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    try {
      final lista = await Api.instancia.dispositivos();
      if (mounted) {
        setState(() {
          _dispositivos = lista;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.mensaje);
    }
  }

  Future<void> _vincular() async {
    final nuevo = await Navigator.of(context)
        .push<Dispositivo>(MaterialPageRoute(builder: (_) => const VincularPantalla()));
    if (nuevo == null) return;
    await _cargar();
    if (mounted) _abrir(nuevo);
  }

  Future<void> _abrir(Dispositivo d) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => DispositivoPantalla(dispositivo: d)));
    _cargar();
  }

  Future<void> _cerrarSesion() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Querés cerrar la sesión en este teléfono?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Cerrar sesión')),
        ],
      ),
    );
    if (ok == true) await Sesion.instancia.cerrar();
  }

  @override
  Widget build(BuildContext context) {
    final nombre = Sesion.instancia.cliente?.nombre;
    return Scaffold(
      appBar: AppBar(
        title: const Text('AquaControl', style: TextStyle(fontWeight: FontWeight.w700)),
        actions: [IconButton(onPressed: _cerrarSesion, icon: const Icon(Icons.logout), tooltip: 'Cerrar sesión')],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _vincular,
        icon: const Icon(Icons.add),
        label: const Text('Vincular'),
      ),
      body: RefreshIndicator(
        onRefresh: _cargar,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            Text(nombre == null ? 'Tus dispositivos' : 'Hola, $nombre',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('Tocá un dispositivo para ver su consumo en tiempo real.',
                style: TextStyle(color: colorTextoSuave)),
            const SizedBox(height: 16),
            if (_error != null) ...[MensajeError(_error!), const SizedBox(height: 12)],
            if (_dispositivos == null && _error == null)
              const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
            if (_dispositivos != null && _dispositivos!.isEmpty) const _SinDispositivos(),
            ...?_dispositivos?.map((d) => _TarjetaDispositivo(dispositivo: d, alTocar: () => _abrir(d))),
          ],
        ),
      ),
    );
  }
}

class _TarjetaDispositivo extends StatelessWidget {
  final Dispositivo dispositivo;
  final VoidCallback alTocar;
  const _TarjetaDispositivo({required this.dispositivo, required this.alTocar});

  @override
  Widget build(BuildContext context) {
    final d = dispositivo;
    return Card(
      child: ListTile(
        onTap: alTocar,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: colorPrimario.withValues(alpha: 0.12),
          child: const Icon(Icons.water_drop_outlined, color: colorPrimario),
        ),
        title: Text(d.nombre, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Row(children: [
          Icon(Icons.circle, size: 10, color: d.enLinea ? colorOk : colorTextoSuave),
          const SizedBox(width: 6),
          Flexible(
            child: Text(d.enLinea
                ? 'En línea'
                : d.ultimaConexion == null
                    ? 'Todavía no envió datos'
                    : 'Desconectado · ${haceCuanto(d.ultimaConexion!)}'),
          ),
        ]),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class _SinDispositivos extends StatelessWidget {
  const _SinDispositivos();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          const Icon(Icons.sensors, size: 40, color: colorPrimario),
          const SizedBox(height: 10),
          Text('Todavía no tenés dispositivos', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          const Text(
            'Encendé tu ESP32, conectalo a tu Wi-Fi y tocá "Vincular" para escribir el código de 6 caracteres que muestra.',
            textAlign: TextAlign.center,
            style: TextStyle(color: colorTextoSuave),
          ),
        ]),
      ),
    );
  }
}
