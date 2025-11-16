
import React from 'react';

export const SkeletonLine: React.FC<{ width?: string; height?: string; className?: string }> = ({ width = 'w-full', height = 'h-4', className }) => (
    <div className={`bg-gray-200 dark:bg-slate-700 rounded animate-pulse ${width} ${height} ${className}`} />
);

export const SkeletonCard: React.FC = () => (
    <div className="p-4 bg-gray-50 rounded-lg border dark:bg-slate-800 dark:border-slate-700">
        <div className="flex justify-between items-center">
            <div className="w-3/5 space-y-2">
                <SkeletonLine height="h-5" />
                <SkeletonLine height="h-3" width="w-4/5" />
            </div>
            <div className="w-1/4">
                <SkeletonLine height="h-8" />
            </div>
        </div>
    </div>
);

export const TableSkeleton: React.FC<{ rows?: number, columns: number }> = ({ rows = 4, columns }) => (
    <tbody className="bg-white dark:bg-slate-800">
        {[...Array(rows)].map((_, i) => (
            <tr key={i}>
                {[...Array(columns)].map((_, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap">
                        <SkeletonLine />
                    </td>
                ))}
            </tr>
        ))}
    </tbody>
);
