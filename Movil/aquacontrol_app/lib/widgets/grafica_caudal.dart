import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../modelos.dart';
import '../tema.dart';

// Gráfica del caudal (L/min) de los últimos minutos. Si entre dos lecturas
// pasaron más de 30 s (el dispositivo estuvo desconectado), la línea se corta.
class GraficaCaudal extends StatelessWidget {
  final List<Lectura> lecturas;
  const GraficaCaudal({super.key, required this.lecturas});

  static const _hueco = Duration(seconds: 30);

  @override
  Widget build(BuildContext context) {
    if (lecturas.isEmpty) {
      return const SizedBox(
        height: 160,
        child: Center(child: Text('Sin lecturas en los últimos 10 minutos', style: TextStyle(color: colorTextoSuave))),
      );
    }

    final puntos = <FlSpot>[];
    for (var i = 0; i < lecturas.length; i++) {
      final l = lecturas[i];
      if (i > 0 && l.fecha.difference(lecturas[i - 1].fecha) > _hueco) puntos.add(FlSpot.nullSpot);
      puntos.add(FlSpot(l.fecha.millisecondsSinceEpoch / 1000, l.caudal));
    }
    final maximo = lecturas.map((l) => l.caudal).fold<double>(0, (a, b) => b > a ? b : a);

    return SizedBox(
      height: 180,
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: maximo < 2 ? 2 : (maximo * 1.2).ceilToDouble(),
          gridData: const FlGridData(drawVerticalLine: false),
          borderData: FlBorderData(show: false),
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipItems: (puntosTocados) => puntosTocados
                  .map((p) => LineTooltipItem(
                        '${p.y.toStringAsFixed(2)} L/min\n${_hora(p.x)}',
                        const TextStyle(color: Colors.white, fontSize: 12),
                      ))
                  .toList(),
            ),
          ),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 32,
                getTitlesWidget: (v, meta) =>
                    Text(v.toStringAsFixed(0), style: const TextStyle(fontSize: 10, color: colorTextoSuave)),
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 22,
                interval: 120,
                getTitlesWidget: (v, meta) =>
                    Text(_hora(v, segundos: false), style: const TextStyle(fontSize: 10, color: colorTextoSuave)),
              ),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: puntos,
              isCurved: true,
              preventCurveOverShooting: true,
              color: colorPrimario,
              barWidth: 2.5,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(show: true, color: colorPrimario.withValues(alpha: 0.12)),
            ),
          ],
        ),
        duration: Duration.zero,
      ),
    );
  }

  static String _hora(double segundosEpoch, {bool segundos = true}) {
    final f = DateTime.fromMillisecondsSinceEpoch((segundosEpoch * 1000).round());
    String dos(int n) => n.toString().padLeft(2, '0');
    return segundos ? '${dos(f.hour)}:${dos(f.minute)}:${dos(f.second)}' : '${dos(f.hour)}:${dos(f.minute)}';
  }
}
