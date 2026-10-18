import React from 'react';
import PMDashboard from './PMDashboard';

/**
 * Projects / Construction Projects Registry page wrapper
 */
export default function Projects(props) {
  return <PMDashboard {...props} initialPage="projects" />;
}
