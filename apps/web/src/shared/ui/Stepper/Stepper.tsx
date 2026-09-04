import React, { useState, Children, useRef, useLayoutEffect, type HTMLAttributes, type ReactNode } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  onBeforeNext?: (fromStep: number) => boolean | Promise<boolean>;
  stepAriaLabel?: (step: number) => string;
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  nextButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (props: {
    step: number;
    currentStep: number;
    onStepClick: (clicked: number) => void;
  }) => ReactNode;
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onBeforeNext,
  stepAriaLabel = step => `Step ${step}`,
  onFinalStepCompleted = () => {},
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  completeButtonText = 'Complete',
  disableStepIndicators = false,
  renderStepIndicator,
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<number>(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) {
      onFinalStepCompleted();
    } else {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const jumpTo = async (target: number) => {
    if (target === currentStep) return;
    if (target > currentStep && onBeforeNext && !(await onBeforeNext(currentStep))) return;
    setDirection(target > currentStep ? 1 : -1);
    updateStep(target);
  };

  const handleNext = async () => {
    if (isLastStep) return;
    if (onBeforeNext && !(await onBeforeNext(currentStep))) return;
    setDirection(1);
    updateStep(currentStep + 1);
  };

  const handleComplete = async () => {
    if (onBeforeNext && !(await onBeforeNext(currentStep))) return;
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div className="flex w-full flex-col" {...rest}>
      <div className={`w-full ${stepCircleContainerClassName}`}>
        <div className={`${stepContainerClassName} flex w-full items-center pb-6`}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: clicked => { void jumpTo(clicked); }
                  })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    label={stepAriaLabel(stepNumber)}
                    disableStepIndicators={disableStepIndicators}
                    currentStep={currentStep}
                    onClickStep={clicked => { void jumpTo(clicked); }}
                  />
                )}
                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            );
          })}
        </div>

        <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={direction}
          className={`space-y-2 ${contentClassName}`}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted && (
          <div
            data-testid="stepper-footer"
            className={`mt-8 border-t border-border pt-4 ${footerClassName}`}
          >
            <div className={`flex gap-2 ${currentStep !== 1 ? 'justify-between' : 'justify-end'}`}>
              {currentStep !== 1 && (
                <button
                  onClick={handleBack}
                  type="button"
                  className={`h-9 rounded-md border border-input px-4 text-sm font-medium transition-colors ${
                    currentStep === 1
                      ? 'pointer-events-none opacity-50 text-muted-foreground'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                  {...backButtonProps}
                >
                  {backButtonText}
                </button>
              )}
              <button
                onClick={() => { void (isLastStep ? handleComplete() : handleNext()); }}
                type="button"
                className="flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                {...nextButtonProps}
              >
                {isLastStep ? completeButtonText : nextButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StepContentWrapperProps {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className = ''
}: StepContentWrapperProps) {
  const [parentHeight, setParentHeight] = useState<number>(0);

  return (
    <motion.div
      style={{ position: 'relative', overflow: 'hidden' }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={{ type: 'spring', duration: 0.4 }}
      className={className}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={h => setParentHeight(h)}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface SlideTransitionProps {
  children: ReactNode;
  direction: number;
  onHeightReady: (height: number) => void;
}

function SlideTransition({ children, direction, onHeightReady }: SlideTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      onHeightReady(containerRef.current.offsetHeight);
    }
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.4 }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  );
}

const stepVariants: Variants = {
  enter: (dir: number) => ({
    x: dir >= 0 ? '-100%' : '100%',
    opacity: 0
  }),
  center: {
    x: '0%',
    opacity: 1
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? '50%' : '-50%',
    opacity: 0
  })
};

interface StepProps {
  children: ReactNode;
}

export function Step({ children }: StepProps) {
  return <div className="px-8">{children}</div>;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  onClickStep: (clicked: number) => void;
  label: string;
  disableStepIndicators?: boolean;
}

function StepIndicator({ step, currentStep, onClickStep, label, disableStepIndicators = false }: StepIndicatorProps) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) {
      onClickStep(step);
    }
  };

  const tone =
    status === 'inactive'
      ? 'bg-muted text-muted-foreground'
      : 'bg-primary text-primary-foreground';

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-current={status === 'active' ? 'step' : undefined}
      onClick={handleClick}
      disabled={disableStepIndicators}
      className={`relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        disableStepIndicators ? 'pointer-events-none opacity-50' : 'cursor-pointer'
      }`}
      animate={{ scale: status === 'active' ? 1.05 : 1 }}
      initial={false}
      transition={{ duration: 0.3 }}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${tone}`}
      >
        {status === 'complete' ? (
          <CheckIcon className="h-4 w-4" />
        ) : status === 'active' ? (
          <span className="h-3 w-3 rounded-full bg-primary-foreground" />
        ) : (
          <span className="text-sm">{step}</span>
        )}
      </span>
    </motion.button>
  );
}

interface StepConnectorProps {
  isComplete: boolean;
}

function StepConnector({ isComplete }: StepConnectorProps) {
  const lineVariants: Variants = {
    incomplete: { width: 0 },
    complete: { width: '100%' }
  };

  return (
    <div className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded bg-border">
      <motion.div
        className="absolute left-0 top-0 h-full bg-primary"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? 'complete' : 'incomplete'}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

interface CheckIconProps extends React.SVGProps<SVGSVGElement> {}

function CheckIcon(props: CheckIconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          delay: 0.1,
          type: 'tween',
          ease: 'easeOut',
          duration: 0.3
        }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
