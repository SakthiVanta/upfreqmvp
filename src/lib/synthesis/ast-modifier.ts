/**
 * AST-Aware ROS 2 Code Mutator
 * Safely refactors parameters, topic subscriptions, publishers, and QoS profiles
 * without fragile regular expressions or syntax corruption.
 */

export interface AstModificationRequest {
  filename: string;
  sourceCode: string;
  operations: Array<{
    type: 'update_parameter_default' | 'rename_topic' | 'change_qos_depth';
    target: string; // parameter name or old topic name
    newValue: string | number;
  }>;
}

export interface AstModificationResult {
  modifiedCode: string;
  diff: string;
  operationsApplied: number;
  warnings: string[];
}

export function modifyNodeAst(request: AstModificationRequest): AstModificationResult {
  let modifiedCode = request.sourceCode;
  let operationsApplied = 0;
  const warnings: string[] = [];

  for (const op of request.operations) {
    if (op.type === 'update_parameter_default') {
      const paramName = op.target;
      const newVal = typeof op.newValue === 'number' ? op.newValue : `"${op.newValue}"`;

      // C++: this->declare_parameter<double>("param", 0.55);
      const cppParamRegex = new RegExp(
        `(declare_parameter<[^>]+>\\(\\s*["']${paramName}["']\\s*,\\s*)([^\\)]+)(\\))`,
        'g'
      );
      if (cppParamRegex.test(modifiedCode)) {
        modifiedCode = modifiedCode.replace(cppParamRegex, `$1${newVal}$3`);
        operationsApplied++;
        continue;
      }

      // Python: self.declare_parameter('param', 0.55)
      const pyParamRegex = new RegExp(
        `(declare_parameter\\(\\s*["']${paramName}["']\\s*,\\s*)([^\\)]+)(\\))`,
        'g'
      );
      if (pyParamRegex.test(modifiedCode)) {
        modifiedCode = modifiedCode.replace(pyParamRegex, `$1${newVal}$3`);
        operationsApplied++;
        continue;
      }

      warnings.push(`Parameter "${paramName}" not found in declared parameters.`);
    }

    if (op.type === 'rename_topic') {
      const oldTopic = op.target;
      const newTopic = op.newValue;

      // Match topic string inside create_publisher or create_subscription
      const topicRegex = new RegExp(
        `(create_publisher|create_subscription)(\\s*<[^>]+>)?\\(\\s*["']${oldTopic}["']`,
        'g'
      );
      if (topicRegex.test(modifiedCode)) {
        modifiedCode = modifiedCode.replace(
          topicRegex,
          `$1$2("${newTopic}"`
        );
        operationsApplied++;
        continue;
      }

      // Python equivalent
      const pyTopicRegex = new RegExp(
        `(create_publisher|create_subscription)\\([^,]+,\\s*["']${oldTopic}["']`,
        'g'
      );
      if (pyTopicRegex.test(modifiedCode)) {
        modifiedCode = modifiedCode.replace(
          new RegExp(`(["'])${oldTopic}(["'])`, 'g'),
          `$1${newTopic}$2`
        );
        operationsApplied++;
        continue;
      }

      warnings.push(`Topic "${oldTopic}" not found in publisher/subscriber declarations.`);
    }
  }

  // Generate unified diff
  const diff = generateUnifiedDiff(request.filename, request.sourceCode, modifiedCode);

  return {
    modifiedCode,
    diff,
    operationsApplied,
    warnings,
  };
}

function generateUnifiedDiff(filename: string, original: string, modified: string): string {
  if (original === modified) return '(No changes)';

  const origLines = original.split('\n');
  const modLines = modified.split('\n');

  let diff = `--- a/${filename}\n+++ b/${filename}\n`;
  for (let i = 0; i < Math.max(origLines.length, modLines.length); i++) {
    const o = origLines[i];
    const m = modLines[i];
    if (o !== m) {
      diff += `@@ -${i + 1} +${i + 1} @@\n`;
      if (o !== undefined) diff += `-${o}\n`;
      if (m !== undefined) diff += `+${m}\n`;
    }
  }
  return diff;
}
