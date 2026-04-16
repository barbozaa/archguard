import pc from 'picocolors';
import { Violation } from '@domain/types.js';

export function printLayerViolationSummary(violations: Violation[]): void {
  console.log(pc.dim('  Impact: ') + 'Breaks architectural boundaries and separation of concerns');
  console.log();
  console.log(pc.dim('  Architectural violations:'));

  violations.forEach((v, idx) => {
    const layerMatch = v.message.match(/(\w+) layer importing from (\w+) layer/);
    if (layerMatch) {
      const [, fromLayer, toLayer] = layerMatch;
      console.log(`    ${pc.yellow((idx + 1) + '.')} ${fromLayer} → ${toLayer} ${pc.dim(`— ${v.file}`)}`);
    } else {
      console.log(`    ${pc.yellow((idx + 1) + '.')} ${v.file} → ${v.relatedFile || 'unknown'}`);
    }
  });

  console.log();
  console.log(pc.bold('  💡 Suggested Fix:'));
  console.log('     Respect layer hierarchy and use dependency inversion.');
  console.log('     Move shared logic to allowed layers or use interfaces.');
}
