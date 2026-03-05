import {
  type RouteConfig,
  index,
  layout,
  route,
} from '@react-router/dev/routes';

export default [
  // Public routes (no sidebar)
  route('/login', 'routes/login.tsx'),

  // Protected routes (with sidebar)
  layout('components/app-layout.tsx', [
    index('routes/channels.tsx'),
    route('/stats', 'routes/stats.tsx'),
  ]),
] satisfies RouteConfig;
