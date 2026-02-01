// Confidence Score Badge Component
import { formatConfidence, formatPercentage } from '~lib/utils/formatters';

interface ConfidenceScoreProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceScore({ score, showLabel = true, size = 'md' }: ConfidenceScoreProps) {
  const { level, color, text } = formatConfidence(score);
  
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  };
  
  return (
    <div className="flex items-center gap-2">
      <span className={`flash-badge ${color} ${sizeStyles[size]} font-semibold`}>
        {formatPercentage(score)}
      </span>
      {showLabel && <span className="text-sm text-gray-600">{text}</span>}
    </div>
  );
}

interface ConfidenceBarProps {
  score: number;
  height?: string;
}

export function ConfidenceBar({ score, height = 'h-2' }: ConfidenceBarProps) {
  const { level } = formatConfidence(score);
  
  const colorStyles = {
    high: 'bg-success-500',
    medium: 'bg-warning-500',
    low: 'bg-danger-500',
  };
  
  return (
    <div className={`w-full bg-gray-200 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${colorStyles[level]} ${height} rounded-full transition-all duration-300`}
        style={{ width: `${score * 100}%` }}
      />
    </div>
  );
}
