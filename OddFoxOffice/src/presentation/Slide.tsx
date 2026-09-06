import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { staggerContainer } from "./slideVariants";
import "./Slide.css";

interface SlideProps {
  children: ReactNode;
  align?: "center" | "start";
  tone?: "default" | "accent" | "dim";
}

export function Slide({ children, align = "start", tone = "default" }: SlideProps) {
  return (
    <motion.section
      className={`slide slide--${align} slide--${tone}`}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <div className="slide__inner">{children}</div>
    </motion.section>
  );
}
