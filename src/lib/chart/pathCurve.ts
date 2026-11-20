import { curveLinear } from '@visx/curve'

/** Forecast paths are straight segments: the line joins the points of its series and adds no curve between them. */
export const PATH_CURVE = curveLinear
