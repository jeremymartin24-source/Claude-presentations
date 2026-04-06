import { motion } from 'framer-motion';

interface Props {
  options: string[];
  onAnswer: (answer: string) => void;
  disabled?: boolean;
  correctAnswer?: string;
  selectedAnswer?: string;
}

const COLORS = [
  { base: 'bg-red-700 border-red-500', correct: 'bg-green-600 border-green-400', wrong: 'bg-gray-800 border-gray-700' },
  { base: 'bg-blue-700 border-blue-500', correct: 'bg-green-600 border-green-400', wrong: 'bg-gray-800 border-gray-700' },
  { base: 'bg-yellow-600 border-yellow-400', correct: 'bg-green-600 border-green-400', wrong: 'bg-gray-800 border-gray-700' },
  { base: 'bg-green-700 border-green-500', correct: 'bg-green-600 border-green-400', wrong: 'bg-gray-800 border-gray-700' },
];
const ICONS = ['🔺', '🔷', '⭐', '🟢'];

export default function StudentAnswerGrid({ options, onAnswer, disabled, correctAnswer, selectedAnswer }: Props) {
  const getColor = (opt: string, i: number) => {
    if (!correctAnswer) return COLORS[i % 4].base;
    if (opt === correctAnswer) return COLORS[i % 4].correct;
    return COLORS[i % 4].wrong;
  };

  return (
    <div className="grid grid-cols-1 gap-3 w-full max-w-md mx-auto">
      {options.map((opt, i) => (
        <motion.button key={i} whileTap={{ scale: 0.96 }}
          onClick={() => !disabled && onAnswer(opt)}
          className={`border-2 rounded-2xl p-5 text-white font-bold text-lg text-left transition-all flex items-center gap-3
            ${getColor(opt, i)}
            ${disabled ? 'cursor-default' : 'cursor-pointer'}
            ${selectedAnswer === opt ? 'ring-4 ring-white ring-offset-2 ring-offset-black' : ''}
          `}
        >
          <span className="text-2xl shrink-0">{ICONS[i % 4]}</span>
          <span className="flex-1">{opt}</span>
          {correctAnswer && opt === correctAnswer && <span className="text-2xl">✓</span>}
          {correctAnswer && opt === selectedAnswer && opt !== correctAnswer && <span className="text-2xl">✗</span>}
        </motion.button>
      ))}
    </div>
  );
}
