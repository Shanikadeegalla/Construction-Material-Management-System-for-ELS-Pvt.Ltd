import React from 'react';
import PMDashboard from './PMDashboard';

/**
 * Project Workspace Management page wrapper
 */
export default function ProjectWorkspace(props) {
  return <PMDashboard {...props} initialPage="projects" />;
}
