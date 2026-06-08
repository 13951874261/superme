import React from 'react';
import { EbbinghausPoint, EbbinghausData } from '../services/vocabAPI';
import { Calendar, Award, Zap } from 'lucide-react';

interface EbbinghausChartProps {
  data: EbbinghausData;
}

export default function EbbinghausChart({ data }: EbbinghausChartProps) {
  const { points = [] } = data;
  
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-xs text-gray-400">
        无曲线数据
      </div>
    );
  }

  const width = 500;
  const height = 240;
  const paddingTop = 20;
  const paddingBottom = 40;
  const paddingLeft = 45;
  const paddingRight = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // 动态决定最大渲染天数（以防止超期复习导致溢出）
  const maxDay = Math.max(30, ...points.map(p => p.day));

  const getX = (day: number) => {
    return paddingLeft + (day / maxDay) * chartWidth;
  };

  const getY = (retention: number) => {
    return height - paddingBottom - (retention / 100) * chartHeight;
  };

  const mapQualityToRetention = (q: number) => {
    switch (q) {
      case 5: return 100;
      case 4: return 85;
      case 3: return 70;
      case 2: return 50;
      case 1: return 30;
      case 0: return 15;
      default: return 100; // 首次加入
    }
  };

  const getQualityColor = (q: number) => {
    switch (q) {
      case 5: return '#10B981'; // 轻松 - 翡翠绿
      case 4: return '#3B82F6'; // 记住 - 炫酷蓝
      case 3: return '#8B5CF6'; // 朦胧 - 罗兰紫
      case 2: return '#F59E0B'; // 遗忘 - 琥珀橙
      case 0: return '#EF4444'; // 彻底忘记 - 珊瑚红
      default: return '#10B981';
    }
  };

  const getQualityText = (q: number) => {
    switch (q) {
      case 5: return '轻松';
      case 4: return '记住';
      case 3: return '模糊';
      case 2: return '忘词';
      case 0: return '生词';
      default: return '收录';
    }
  };

  // 分离理论曲线和实际打点轨迹
  const theoreticalPoints = points.filter(p => p.is_theoretical);
  const actualPoints = points.filter(p => !p.is_theoretical).map(p => ({
    ...p,
    yVal: mapQualityToRetention(p.quality ?? 5)
  }));

  // 构建理论曲线 Path (折线/平滑曲线模拟)
  let theoreticalPath = '';
  theoreticalPoints.forEach((p, idx) => {
    const x = getX(p.day);
    const y = getY(p.retention_estimated ?? 20);
    if (idx === 0) {
      theoreticalPath += `M ${x} ${y}`;
    } else {
      theoreticalPath += ` L ${x} ${y}`;
    }
  });

  // 构建实际复习轨迹 Path
  let actualPath = '';
  actualPoints.forEach((p, idx) => {
    const x = getX(p.day);
    const y = getY(p.yVal);
    if (idx === 0) {
      actualPath += `M ${x} ${y}`;
    } else {
      actualPath += ` L ${x} ${y}`;
    }
  });

  // 生成网格坐标 (Y轴是留存率，X轴是天数)
  const yGridValues = [20, 40, 60, 80, 100];
  const xGridValues = Array.from({ length: 6 }, (_, i) => Math.round((maxDay / 5) * i));

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-black text-slate-700 tracking-wider flex items-center gap-1.5 uppercase">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          Ebbinghaus 艾宾浩斯记忆追踪
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-indigo-300 inline-block"></span>
            <span className="text-slate-400">理论遗忘曲线</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-amber-500 inline-block"></span>
            <span className="text-slate-500">实际复习轨迹</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[440px] h-auto overflow-visible">
          {/* Y 轴网格线 */}
          {yGridValues.map(val => (
            <g key={val}>
              <line
                x1={paddingLeft}
                y1={getY(val)}
                x2={width - paddingRight}
                y2={getY(val)}
                stroke="#E2E8F0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={getY(val) + 3}
                textAnchor="end"
                className="text-[9px] font-mono fill-slate-400 font-bold"
              >
                {val}%
              </text>
            </g>
          ))}

          {/* X 轴网格线 */}
          {xGridValues.map(val => (
            <g key={val}>
              <line
                x1={getX(val)}
                y1={paddingTop}
                x2={getX(val)}
                y2={height - paddingBottom}
                stroke="#E2E8F0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={getX(val)}
                y={height - paddingBottom + 15}
                textAnchor="middle"
                className="text-[9px] font-mono fill-slate-400 font-bold"
              >
                第{val}天
              </text>
            </g>
          ))}

          {/* 绘制标准理论曲线 */}
          {theoreticalPath && (
            <path
              d={theoreticalPath}
              fill="none"
              stroke="#C7D2FE"
              strokeWidth={2.5}
            />
          )}

          {/* 绘制实际轨迹虚线 */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          )}

          {/* 绘制实际复习数据节点 */}
          {actualPoints.map((p, idx) => {
            const cx = getX(p.day);
            const cy = getY(p.yVal);
            const color = getQualityColor(p.quality ?? 5);
            return (
              <g key={idx} className="cursor-pointer group">
                <circle
                  cx={cx}
                  cy={cy}
                  r={5.5}
                  fill={color}
                  stroke="#FFF"
                  strokeWidth={2}
                  className="transition-all duration-200 group-hover:r-7"
                />
                {/* 简单的交互 Tooltip 标签 */}
                <rect
                  x={cx - 18}
                  y={cy - 22}
                  width={36}
                  height={14}
                  rx={4}
                  fill={color}
                  className="hidden group-hover:block filter drop-shadow-sm"
                />
                <text
                  x={cx}
                  y={cy - 12}
                  textAnchor="middle"
                  fill="#FFF"
                  fontSize="8"
                  className="hidden group-hover:block font-bold"
                >
                  {getQualityText(p.quality ?? 5)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 bg-white border border-slate-100/50 rounded-xl px-3 py-2">
        <span className="flex items-center gap-1 font-medium">
          <Award className="w-3.5 h-3.5 text-emerald-500" />
          初始记忆留存: 100%
        </span>
        <span className="flex items-center gap-1 font-medium">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          实际复习次数: {actualPoints.length - 1} 次
        </span>
      </div>
    </div>
  );
}
