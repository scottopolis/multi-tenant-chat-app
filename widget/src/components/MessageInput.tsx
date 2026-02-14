import { KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const { register, handleSubmit, watch, reset } = useForm<{ message: string }>({
    defaultValues: { message: '' },
    mode: 'onChange',
  });

  const message = watch('message');

  const handleFormSubmit = ({ message }: { message: string }) => {
    if (!message.trim() || disabled) return;
    onSend(message);
    reset({ message: '' });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Submit on Enter (but not Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(handleFormSubmit)();
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex gap-3 p-4 border-t border-gray-200 bg-white">
      <Input
        onKeyDown={handleKeyDown}
        {...register('message')}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
        autoFocus
      />
      <Button
        type="submit"
        disabled={disabled || !message.trim()}
        size="icon"
        className="shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
