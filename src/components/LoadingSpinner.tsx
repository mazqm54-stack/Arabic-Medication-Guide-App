import React from 'react';
import { SkeletonLoader } from './SkeletonLoader';

export interface LoadingSpinnerProps {
  type?: 'box' | 'prescription';
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  type = 'box',
  message,
}) => {
  return (
    <SkeletonLoader type={type} message={message} count={4} />
  );
};
