import { cn } from "@/lib/utils";
import { getCharacterCount } from "@shared/validation";

interface CharacterCounterProps {
  value: string;
  maxLength: number;
  className?: string;
}

export function CharacterCounter({ value, maxLength, className }: CharacterCounterProps) {
  const { count, remaining, isOverLimit } = getCharacterCount(value, maxLength);

  return (
    <div className={cn(
      "text-sm transition-colors",
      isOverLimit ? "text-destructive" : remaining <= 10 ? "text-orange-500" : "text-muted-foreground",
      className
    )}>
      {count}/{maxLength}
      {isOverLimit && (
        <span className="ml-1 font-medium">
          ({Math.abs(remaining)} over limit)
        </span>
      )}
    </div>
  );
}

interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  maxLength?: number;
  showCounter?: boolean;
  helperText?: string;
}

export function ValidatedInput({
  label,
  error,
  maxLength,
  showCounter = false,
  helperText,
  value = '',
  className,
  ...props
}: ValidatedInputProps) {
  const hasError = Boolean(error);
  const stringValue = String(value);

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          {...props}
          value={value}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            hasError && "border-destructive focus-visible:ring-destructive",
            className
          )}
        />
      </div>

      <div className="flex justify-between items-start">
        <div className="flex-1">
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          {!error && helperText && (
            <p className="text-sm text-muted-foreground">{helperText}</p>
          )}
        </div>
        
        {showCounter && maxLength && (
          <CharacterCounter
            value={stringValue}
            maxLength={maxLength}
            className="ml-2 flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
}

interface ValidatedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  maxLength?: number;
  showCounter?: boolean;
  helperText?: string;
}

export function ValidatedTextarea({
  label,
  error,
  maxLength,
  showCounter = false,
  helperText,
  value = '',
  className,
  ...props
}: ValidatedTextareaProps) {
  const hasError = Boolean(error);
  const stringValue = String(value);

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
          {props.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <textarea
          {...props}
          value={value}
          className={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            hasError && "border-destructive focus-visible:ring-destructive",
            className
          )}
        />
      </div>

      <div className="flex justify-between items-start">
        <div className="flex-1">
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
          {!error && helperText && (
            <p className="text-sm text-muted-foreground">{helperText}</p>
          )}
        </div>
        
        {showCounter && maxLength && (
          <CharacterCounter
            value={stringValue}
            maxLength={maxLength}
            className="ml-2 flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
}