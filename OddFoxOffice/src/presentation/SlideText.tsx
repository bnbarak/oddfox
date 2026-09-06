import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp } from "./slideVariants";

interface TextProps {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children }: TextProps) {
  return (
    <motion.span className="slide__eyebrow" variants={fadeUp}>
      {children}
    </motion.span>
  );
}

export function Title({ children }: TextProps) {
  return (
    <motion.h1 className="slide__title" variants={fadeUp}>
      {children}
    </motion.h1>
  );
}

export function Subtitle({ children }: TextProps) {
  return (
    <motion.p className="slide__subtitle" variants={fadeUp}>
      {children}
    </motion.p>
  );
}

export function Body({ children }: TextProps) {
  return (
    <motion.p className="slide__body" variants={fadeUp}>
      {children}
    </motion.p>
  );
}

export function FadeItem({ children, className }: TextProps) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}
