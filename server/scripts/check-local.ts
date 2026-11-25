import { simplifyLocally } from '../src/services/localSimplifier.ts';

const samples = [
  `## Введение

В настоящее время в связи с тем, что осуществляется процесс оптимизации образовательного процесса, необходимо отметить, что данный подход является достаточно эффективным. Исследование 2023 года показало рост успеваемости на 15% среди студентов МГУ.

- Данный метод является основой обучения.
- Оптимизация процессов происходит в течение учебного года.

Формула: $E = mc^2$`,
  `Данная методика представляет собой совокупность приёмов. В процессе реализации проекта применяется итерационный подход. Таким образом, эффективность работы повышается.`,
];

for (const [index, sample] of samples.entries()) {
  console.log(`\n===== sample ${index + 1} / beginner =====`);
  console.log(simplifyLocally(sample, 'beginner'));
  console.log(`\n===== sample ${index + 1} / slightly =====`);
  console.log(simplifyLocally(sample, 'slightly_simpler'));
}
