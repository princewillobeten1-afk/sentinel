import { RouteSkeleton } from '@/components/layout/route-skeleton';

/**
 * Painted while this route's bundle loads.
 *
 * Without it Next shows nothing until the segment is ready — measured at
 * eight seconds or more on this route, as a bare spinner.
 */
export default function Loading() {
  return <RouteSkeleton />;
}
