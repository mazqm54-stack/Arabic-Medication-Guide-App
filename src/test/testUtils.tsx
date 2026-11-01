import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * Custom test wrapper that ensures components render within an RTL Arabic container.
 */
const AllProviders: React.FC<WrapperProps> = ({ children }) => {
  return (
    <div dir="rtl" lang="ar" className="font-sans bg-[#F8F9FA] text-[#1D3557] min-h-screen">
      {children}
    </div>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

export * from '@testing-library/react';
export { customRender as renderWithRtl };
