import './ChartPlaceholder.css'

/**
 * Static SVG chart ported from prototype/trade.html. Stand-in until
 * the visx-based real chart is ready in /labs/chart.
 */
export function ChartPlaceholder() {
  return (
    <div className="chart-placeholder">
      <svg
        className="chart-placeholder__svg"
        viewBox="0 0 1200 560"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Grid lines (horizontal only) */}
        <g>
          <line className="cp-grid" x1="0" y1="479" x2="1140" y2="479" />
          <line className="cp-grid" x1="0" y1="395" x2="1140" y2="395" />
          <line className="cp-grid" x1="0" y1="312" x2="1140" y2="312" />
          <line className="cp-grid" x1="0" y1="228" x2="1140" y2="228" />
          <line className="cp-grid" x1="0" y1="144" x2="1140" y2="144" />
          <line className="cp-grid" x1="0" y1="61" x2="1140" y2="61" />
        </g>

        {/* Y-axis labels */}
        <g>
          <text className="cp-axis" x="1152" y="483">
            10,000
          </text>
          <text className="cp-axis" x="1152" y="399">
            30,000
          </text>
          <text className="cp-axis" x="1152" y="316">
            50,000
          </text>
          <text className="cp-axis" x="1152" y="232">
            70,000
          </text>
          <text className="cp-axis" x="1152" y="148">
            90,000
          </text>
          <text className="cp-axis" x="1152" y="65">
            110,000
          </text>
        </g>

        {/* Prediction paths */}
        <path
          className="cp-pred cp-pred--ultra-bull"
          d="M 545,292 L 580,270 L 620,260 L 660,240 L 700,225 L 740,200 L 780,180 L 820,155 L 860,145 L 900,120 L 940,105 L 980,95 L 1020,80 L 1060,70 L 1100,60 L 1140,55"
        />
        <path
          className="cp-pred cp-pred--bull"
          d="M 545,292 L 580,285 L 620,270 L 660,255 L 700,250 L 740,230 L 780,220 L 820,200 L 860,190 L 900,175 L 940,170 L 980,160 L 1020,155 L 1060,150 L 1100,155 L 1140,150"
        />
        <path
          className="cp-pred cp-pred--neutral"
          d="M 545,292 L 580,295 L 620,285 L 660,290 L 700,285 L 740,290 L 780,280 L 820,285 L 860,275 L 900,280 L 940,270 L 980,275 L 1020,265 L 1060,270 L 1100,275 L 1140,265"
        />
        <path
          className="cp-pred cp-pred--bear"
          d="M 545,292 L 580,310 L 620,320 L 660,330 L 700,340 L 740,350 L 780,355 L 820,365 L 860,370 L 900,375 L 940,380 L 980,385 L 1020,390 L 1060,395 L 1100,400 L 1140,405"
        />
        <path
          className="cp-pred cp-pred--ultra-bear"
          d="M 545,292 L 580,320 L 620,340 L 660,360 L 700,375 L 740,390 L 780,400 L 820,410 L 860,425 L 900,435 L 940,445 L 980,455 L 1020,465 L 1060,470 L 1100,475 L 1140,478"
        />

        {/* Selected path overlay (Bullish) */}
        <path
          className="cp-selected"
          d="M 545,292 L 580,285 L 620,270 L 660,255 L 700,250 L 740,230 L 780,220 L 820,200 L 860,190 L 900,175 L 940,170 L 980,160 L 1020,155 L 1060,150 L 1100,155 L 1140,150"
        />

        {/* Historical price line */}
        <path
          className="cp-history"
          d="M 0,350 L 20,345 L 30,360 L 50,330 L 70,345 L 90,310 L 110,320 L 130,280 L 150,290 L 170,240 L 190,250 L 210,180 L 230,150 L 250,100 L 265,80 L 280,65 L 290,80 L 305,110 L 320,130 L 335,160 L 350,140 L 365,175 L 380,200 L 395,230 L 410,260 L 425,280 L 440,300 L 455,290 L 470,310 L 485,320 L 500,305 L 515,295 L 530,290 L 545,292"
        />

        {/* Now indicator */}
        <line className="cp-now-line" x1="545" y1="40" x2="545" y2="510" />
        <circle className="cp-now-dot" cx="545" cy="292" r="5" />

        {/* Bottom axis rule */}
        <line className="cp-grid" x1="0" y1="510" x2="1140" y2="510" />
      </svg>

      <div className="chart-placeholder__axis-x">
        <span>APR 26</span>
        <span>JUN</span>
        <span>AUG</span>
        <span>OCT</span>
        <span>DEC</span>
        <span>FEB 27</span>
        <span>APR</span>
        <span>JUN</span>
        <span>AUG</span>
        <span>OCT</span>
        <span>DEC</span>
      </div>
    </div>
  )
}
