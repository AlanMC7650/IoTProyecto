import 'dart:async';

import 'package:flutter/material.dart';

import '../config.dart';
import '../modelos.dart';
import '../servicios/api.dart';
import '../servicios/tiempo_real.dart';
import '../tema.dart';
import '../widgets/grafica_caudal.dart';
import 'login.dart';

const _textoMotivo = {
  'fuga': 'Cerrada por una fuga sin confirmar',
  'manual': 'Cerrada desde la app o el dashboard',
  'limite': 'Cerrada: se alcanzó el límite diario',
};

const _textoEvento = {
  'FUGA': 'Fuga',
  'LIMITE': 'Límite',
  'FLUJO_CONTINUO': 'Flujo continuo',
  'VALVULA': 'Válvula',
};

// Un dispositivo en tiempo real: caudal, electroválvula y LED, igual que el
// dashboard web. Los datos iniciales se piden a la API y después cada lectura
// llega sola por el canal de tiempo real (SSE).
class DispositivoPantalla extends StatefulWidget {
  final Dispositivo dispositivo;
  const DispositivoPantalla({super.key, required this.dispositivo});

  @override
  State<DispositivoPantalla> createState() => _DispositivoPantallaState();
}

class _DispositivoPantallaState extends State<DispositivoPantalla> {
  final _api = Api.instancia;
  late final int _id = widget.dispositivo.id;

  List<Lectura> _lecturas = [];
  Lectura? _ultima;
  EstadoDispositivo? _estado;
  List<Evento> _eventos = [];
  bool _cargando = true;
  bool _conectado = false;
  bool _ocupado = false;
  String? _error;
  DateTime _ahora = DateTime.now();

  TiempoReal? _tiempoReal;
  Timer? _reloj;

  @override
  void initState() {
    super.initState();
    _cargar();
    var primeraConexion = true;
    _tiempoReal = TiempoReal(
      idDispositivo: _id,
      alRecibir: _alRecibir,
      alConectar: () {
        if (!mounted) return;
        setState(() => _conectado = true);
        // Al reconectar se recarga, para traer lo que llegó mientras estuvo cortado
        if (!primeraConexion) _cargar();
        primeraConexion = false;
      },
      alDesconectar: () {
        if (mounted) setState(() => _conectado = false);
      },
    );
    // Reloj para pasar a "Desconectado" si dejan de llegar lecturas
    _reloj = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _ahora = DateTime.now());
    });
  }

  @override
  void dispose() {
    _tiempoReal?.cerrar();
    _reloj?.cancel();
    super.dispose();
  }

  Future<void> _cargar() async {
    try {
      final resultados = await Future.wait([
        _api.lecturas(_id, DateTime.now().subtract(rangoGrafica)),
        _api.ultima(_id),
        _api.estado(_id),
        _api.eventos(_id),
      ]);
      if (!mounted) return;
      setState(() {
        _lecturas = resultados[0] as List<Lectura>;
        _ultima = resultados[1] as Lectura?;
        _estado = resultados[2] as EstadoDispositivo;
        _eventos = resultados[3] as List<Evento>;
        _error = null;
        _cargando = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.mensaje;
          _cargando = false;
        });
      }
    }
  }

  void _alRecibir(MensajeTiempoReal m) {
    if (!mounted) return;
    final anterior = _estado;
    setState(() {
      _ultima = m.lectura;
      _estado = m.estado;
      // Las lecturas llegan en orden; se descartan las que ya quedaron fuera del rango
      final minimo = DateTime.now().subtract(rangoGrafica);
      _lecturas = [
        ..._lecturas.where((l) => l.fecha.isAfter(minimo) && l.fecha.isBefore(m.lectura.fecha)),
        m.lectura,
      ];
    });
    // Una fuga nueva, un límite o un cambio de motivo: refrescar los eventos
    if (anterior?.motivo != m.estado.motivo || anterior?.fugasPendientes != m.estado.fugasPendientes) {
      _api.eventos(_id).then((e) {
        if (mounted) setState(() => _eventos = e);
      }).catchError((_) {});
    }
  }

  Future<void> _accion(Future<void> Function() fn) async {
    setState(() {
      _ocupado = true;
      _error = null;
    });
    try {
      await fn();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _cambiarValvula(String modo) => _accion(() async {
        final estado = await _api.cambiarValvula(_id, modo);
        final eventos = await _api.eventos(_id);
        if (mounted) {
          setState(() {
            _estado = estado;
            _eventos = eventos;
          });
        }
      });

  Future<void> _confirmarFuga() => _accion(() async {
        final estado = await _api.atenderFugas(_id);
        final eventos = await _api.eventos(_id);
        if (mounted) {
          setState(() {
            _estado = estado;
            _eventos = eventos;
          });
        }
      });

  Future<void> _editarLimite() async {
    final actual = _estado?.limiteDiarioL;
    final control = TextEditingController(text: actual == null ? '' : actual.toStringAsFixed(0));
    final resultado = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Límite diario'),
        content: TextField(
          controller: control,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
            suffixText: 'L',
            helperText: 'Al llegar al límite, la válvula se cierra sola\n(en modo automático). Vacío = sin límite.',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(c, control.text), child: const Text('Guardar')),
        ],
      ),
    );
    if (resultado == null) return;
    final texto = resultado.trim().replaceAll(',', '.');
    final litros = texto.isEmpty ? null : double.tryParse(texto);
    if (texto.isNotEmpty && (litros == null || litros <= 0)) {
      setState(() => _error = 'El límite tiene que ser un número de litros mayor a 0');
      return;
    }
    await _accion(() async {
      await _api.cambiarLimite(_id, litros);
      final estado = await _api.estado(_id);
      if (mounted) setState(() => _estado = estado);
    });
  }

  bool get _enVivo => _ultima != null && _ahora.difference(_ultima!.fecha) < tiempoEnLinea;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.dispositivo.nombre)),
      body: RefreshIndicator(
        onRefresh: _cargar,
        child: _cargando
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _encabezado(),
                  const SizedBox(height: 12),
                  if (_error != null) ...[MensajeError(_error!), const SizedBox(height: 12)],
                  _panelFlujo(),
                  _panelValvula(),
                  _panelLed(),
                  _panelEventos(),
                ],
              ),
      ),
    );
  }

  Widget _encabezado() {
    final texto = _enVivo
        ? 'En línea'
        : _ultima == null
            ? 'Todavía no envió datos'
            : 'Desconectado · última lectura ${haceCuanto(_ultima!.fecha)}';
    return Row(children: [
      Icon(Icons.circle, size: 11, color: _enVivo ? colorOk : colorTextoSuave),
      const SizedBox(width: 6),
      Expanded(child: Text(texto)),
      Icon(_conectado ? Icons.bolt : Icons.sync, size: 16, color: _conectado ? colorPrimario : colorTextoSuave),
      const SizedBox(width: 4),
      Text(_conectado ? 'Tiempo real' : 'Reconectando…',
          style: TextStyle(fontSize: 12, color: _conectado ? colorPrimario : colorTextoSuave)),
    ]);
  }

  Widget _tarjeta({required String titulo, String? etiqueta, required List<Widget> hijos}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(titulo, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            if (etiqueta != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                    color: colorValvula.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(5)),
                child: Text(etiqueta,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: colorValvula)),
              ),
            ],
          ]),
          const SizedBox(height: 12),
          ...hijos,
        ]),
      ),
    );
  }

  // --- Sensor de flujo YF-S201 ---
  Widget _panelFlujo() {
    final consumo = _estado?.consumoHoyL ?? 0;
    final limite = _estado?.limiteDiarioL;
    final avance = limite == null ? null : (consumo / limite).clamp(0.0, 1.0);
    return _tarjeta(titulo: 'Sensor de flujo YF-S201', hijos: [
      Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Text(_enVivo ? _ultima!.caudal.toStringAsFixed(1) : '—',
            style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w800, color: colorPrimario)),
        const Padding(
          padding: EdgeInsets.only(bottom: 8, left: 6),
          child: Text('L/min', style: TextStyle(color: colorTextoSuave)),
        ),
      ]),
      const SizedBox(height: 6),
      Text(limite == null
          ? 'Hoy: ${consumo.toStringAsFixed(1)} L · sin límite diario'
          : 'Hoy: ${consumo.toStringAsFixed(1)} L de ${limite.toStringAsFixed(0)} L'),
      if (avance != null) ...[
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(5),
          child: LinearProgressIndicator(
            value: avance,
            minHeight: 8,
            color: avance >= 1 ? colorPeligro : colorPrimario,
            backgroundColor: const Color(0xFFE5E9F0),
          ),
        ),
      ],
      TextButton.icon(
        onPressed: _ocupado ? null : _editarLimite,
        icon: const Icon(Icons.speed, size: 18),
        label: Text(limite == null ? 'Definir límite diario' : 'Cambiar límite diario'),
        style: TextButton.styleFrom(padding: EdgeInsets.zero),
      ),
      const SizedBox(height: 6),
      GraficaCaudal(lecturas: _lecturas),
    ]);
  }

  // --- Electroválvula ---
  Widget _panelValvula() {
    final estado = _estado;
    // Lo que reportó el ESP32; si no está en línea, lo que debería hacer
    final bool? abierta = _enVivo && _ultima!.valvulaAbierta != null
        ? _ultima!.valvulaAbierta
        : estado == null
            ? null
            : estado.valvula == 'abrir';
    final esperandoEsp32 = _enVivo &&
        estado != null &&
        abierta != null &&
        ((estado.valvula == 'cerrar' && abierta) || (estado.valvula == 'abrir' && !abierta && !_ultima!.fuga));
    final motivo = estado?.motivo != null
        ? _textoMotivo[estado!.motivo]!
        : estado?.modo == 'abierta'
            ? 'Abierta manualmente'
            : 'Modo automático';
    final fugasPendientes = estado?.fugasPendientes ?? 0;

    return _tarjeta(titulo: 'Electroválvula', etiqueta: 'ACTUADOR', hijos: [
      Row(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          decoration: BoxDecoration(
            color: abierta == null ? const Color(0xFFE5E9F0) : (abierta ? colorOk : colorPeligro),
            borderRadius: BorderRadius.circular(30),
          ),
          child: Text(
            abierta == null ? 'SIN DATOS' : (abierta ? 'ABIERTA' : 'CERRADA'),
            style: TextStyle(
                color: abierta == null ? colorTextoSuave : Colors.white,
                fontWeight: FontWeight.w800,
                letterSpacing: 1),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(child: Text(motivo, style: const TextStyle(color: colorTextoSuave))),
      ]),
      if (esperandoEsp32) ...[
        const SizedBox(height: 8),
        Text('Orden enviada: ${estado.valvula}. El ESP32 la aplica en su próximo envío.',
            style: const TextStyle(fontSize: 12, color: colorValvula)),
      ],
      if (fugasPendientes > 0) ...[
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFFEBEE), borderRadius: BorderRadius.circular(10)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Hay una fuga sin confirmar: la válvula no se abre hasta que la confirmes.',
                style: TextStyle(color: Color(0xFFC62828))),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _ocupado ? null : _confirmarFuga,
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFFC62828)),
              child: const Text('Ya revisé la fuga'),
            ),
          ]),
        ),
      ],
      const SizedBox(height: 12),
      SizedBox(
        width: double.infinity,
        child: SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'abierta', label: Text('Abrir'), icon: Icon(Icons.water_drop)),
            ButtonSegment(value: 'cerrada', label: Text('Cerrar'), icon: Icon(Icons.block)),
            ButtonSegment(value: 'auto', label: Text('Auto'), icon: Icon(Icons.autorenew)),
          ],
          selected: {estado?.modo ?? 'auto'},
          onSelectionChanged: _ocupado ? null : (s) => _cambiarValvula(s.first),
          style: SegmentedButton.styleFrom(selectedBackgroundColor: colorValvula.withValues(alpha: 0.18)),
        ),
      ),
    ]);
  }

  // --- LED RGB (gemelo digital) ---
  Widget _panelLed() {
    final estadoLed = _enVivo ? (_ultima!.ledEstado ?? 'apagado') : 'apagado';
    final brillo = _enVivo ? (_ultima!.ledBrillo ?? 0) : 0;
    final color = coloresLed[estadoLed] ?? coloresLed['apagado']!;
    final intensidad = estadoLed == 'apagado' ? 0.0 : (brillo.clamp(20, 100) / 100);
    return _tarjeta(titulo: 'LED RGB', etiqueta: 'ACTUADOR', hijos: [
      Row(children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 500),
          width: 64,
          height: 64,
          margin: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withValues(alpha: 0.25 + 0.75 * intensidad),
            boxShadow: [BoxShadow(color: color.withValues(alpha: 0.6 * intensidad), blurRadius: 22 * intensidad, spreadRadius: 3 * intensidad)],
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_enVivo ? 'Brillo $brillo %' : 'Sin datos',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: estadoLed == 'apagado' ? colorTextoSuave : color)),
            const SizedBox(height: 4),
            Text(_enVivo ? (textosLed[estadoLed] ?? estadoLed) : 'El dispositivo no está enviando datos',
                style: const TextStyle(color: colorTextoSuave)),
          ]),
        ),
      ]),
    ]);
  }

  // --- Eventos ---
  Widget _panelEventos() {
    return _tarjeta(titulo: 'Eventos recientes', hijos: [
      if (_eventos.isEmpty)
        const Text('Sin eventos: no hubo límites alcanzados ni cambios de válvula.',
            style: TextStyle(color: colorTextoSuave)),
      ..._eventos.map((e) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 92,
                padding: const EdgeInsets.symmetric(vertical: 3),
                decoration: BoxDecoration(
                  color: e.tipo == 'FUGA' ? const Color(0xFFFFEBEE) : const Color(0xFFEEF1F5),
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(_textoEvento[e.tipo] ?? e.tipo,
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(e.detalle ?? '', style: const TextStyle(fontSize: 13)),
                  Text(haceCuanto(e.fecha), style: const TextStyle(fontSize: 11, color: colorTextoSuave)),
                ]),
              ),
            ]),
          )),
    ]);
  }
}
