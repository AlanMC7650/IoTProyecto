import 'package:flutter_test/flutter_test.dart';

import 'package:aquacontrol/modelos.dart';

void main() {
  test('los decimales llegan como texto (API) o como número (tiempo real)', () {
    expect(aDouble('6.333'), 6.333);
    expect(aDouble(6.333), 6.333);
    expect(aDouble(null), isNull);
  });

  test('una lectura del tiempo real se interpreta bien', () {
    final m = MensajeTiempoReal.desdeJson({
      'id_dispositivo': 33,
      'lectura': {
        'caudal_lmin': 6.4, 'volumen_l': 1.2, 'pulsos': 240, 'nivel_agua': 200, 'fuga': false,
        'valvula_abierta': true, 'led_estado': 'amarillo', 'led_brillo': 62,
        'fecha_medicion': '2026-10-18T15:00:00.000Z',
      },
      'estado': {
        'valvula': 'abrir', 'motivo': null, 'modo': 'auto', 'limite_diario_l': null,
        'consumo_hoy_l': 12.5, 'fugas_pendientes': 0,
      },
    });
    expect(m.lectura.caudal, 6.4);
    expect(m.lectura.ledEstado, 'amarillo');
    expect(m.estado.consumoHoyL, 12.5);
  });
}
