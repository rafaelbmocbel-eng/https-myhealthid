import React from 'react';

interface HumanSilhouetteProps {
    className?: string;
    fill?: string;
    opacity?: number;
}

export default function HumanSilhouette({
    className = '',
    fill = 'currentColor',
    opacity = 1
}: HumanSilhouetteProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke={fill}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={{ opacity }}
        >
            <path d="M12 2C10.34 2 9 3.34 9 5C9 6.66 10.34 8 12 8C13.66 8 15 6.66 15 5C15 3.34 13.66 2 12 2Z" fill={fill} stroke="none" />
            <path d="M12 9C9.24 9 7 11.24 7 14V19C7 19.55 7.45 20 8 20H9V22C9 22.55 9.45 23 10 23H14C14.55 23 15 22.55 15 22V20H16C16.55 20 17 19.55 17 19V14C17 11.24 14.76 9 12 9Z" fill={fill} stroke="none" />
            <path d="M6.5 10C5.67 10 5 10.67 5 11.5V16.5C5 17.33 5.67 18 6.5 18C7.33 18 8 17.33 8 16.5V11.5C8 10.67 7.33 10 6.5 10Z" fill={fill} stroke="none" />
            <path d="M17.5 10C16.67 10 16 10.67 16 11.5V16.5C16 17.33 16.67 18 17.5 18C18.33 18 19 17.33 19 16.5V11.5C19 10.67 18.33 10 17.5 10Z" fill={fill} stroke="none" />
        </svg>
    );
}
