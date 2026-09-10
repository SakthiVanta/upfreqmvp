// Idempotent seeder for the default robotics fleet (Andino, TurtleBot 4, TurtleBot 3)
// and environment configurations.
//
// Usage: pnpm db:seed:fleet
import { seedRoboticsFleetAndEnvironments } from '../src/lib/db/seed-data';
import { DEMO_USER_ID } from '../src/lib/db/client';

seedRoboticsFleetAndEnvironments(DEMO_USER_ID)
  .then(({ seededProjects, seededRobots }) => {
    console.log(`Successfully seeded ${seededProjects} project(s) and ${seededRobots} robot profile(s).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed fleet failed:', err);
    process.exit(1);
  });
