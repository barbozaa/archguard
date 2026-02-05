import pc from 'picocolors';

/**
 * Formatting utilities for terminal output
 * Handles colors, icons, score bars, and text formatting
 */

export function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '•';
  }
}

export function getSeverityColor(severity: string): (text: string) => string {
  switch (severity) {
    case 'critical': return pc.red;
    case 'warning': return pc.yellow;
    case 'info': return pc.blue;
    default: return pc.white;
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'Excellent': return '✨';
    case 'Healthy': return '✅';
    case 'Needs Attention': return '⚠️';
    case 'Critical': return '🚨';
    default: return '•';
  }
}

export function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'Excellent': return pc.green;
    case 'Healthy': return pc.cyan;
    case 'Needs Attention': return pc.yellow;
    case 'Critical': return pc.red;
    default: return pc.white;
  }
}

export function getScoreColor(score: number): (text: string) => string {
  if (score >= 90) return pc.green;
  if (score >= 75) return pc.cyan;
  if (score >= 60) return pc.yellow;
  return pc.red;
}

export function getScoreBar(score: number): string {
  const filled = Math.floor(score / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  
  if (score >= 90) return pc.green(bar);
  if (score >= 75) return pc.cyan(bar);
  if (score >= 60) return pc.yellow(bar);
  return pc.red(bar);
}

export function formatPriority(priority: string): string {
  switch (priority) {
    case 'HIGH': return pc.red(pc.bold(priority));
    case 'MEDIUM': return pc.yellow(pc.bold(priority));
    case 'LOW': return pc.green(pc.bold(priority));
    default: return pc.dim(priority);
  }
}

export function getRiskColor(level: string): (text: string) => string {
  switch (level) {
    case 'HIGH': return pc.red;
    case 'MEDIUM': return pc.yellow;
    case 'LOW': return pc.cyan;
    default: return pc.green;
  }
}

export function wrapText(text: string, width: number): string {
  const lines = text.split('\n');
  return lines.map(line => {
    if (line.length <= width) return line;
    
    const words = line.split(' ');
    const wrapped: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= width) {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      } else {
        if (currentLine) wrapped.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) wrapped.push(currentLine);
    return wrapped.join('\n');
  }).join('\n');
}

export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}
