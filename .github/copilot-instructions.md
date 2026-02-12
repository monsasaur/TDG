# Copilot Instructions for Ture IoT App

## Overview
This project is an Expo application designed for managing IoT devices. It utilizes a file-based routing system and integrates with a backend API to fetch device data.

## Architecture
- **Main Components**: The app consists of a main layout defined in `_layout.tsx`, which uses the `expo-router` for navigation. The `index.tsx` serves as the home screen, displaying a list of IoT devices.
- **Data Flow**: Device data is fetched from a backend API (`http://localhost:3000/api/devices`) and displayed in the home screen. The data is refreshed every 3 seconds using a polling mechanism.
- **Service Boundaries**: The app communicates with the backend service for device management, which is crucial for understanding the app's functionality.

## Developer Workflows
- **Starting the App**: Use `npm start` to launch the Expo development server. This command will provide options to run the app on various platforms (Android, iOS, web).
- **Resetting the Project**: The command `npm run reset-project` moves starter code to the `app-example` directory and creates a new blank `app` directory for development.
- **Linting**: Run `npm run lint` to check for code quality issues using ESLint.

## Project Conventions
- **File Structure**: The app follows a specific directory structure where components are organized under `app/`, and shared components are placed in `app/components/`. This structure aids in maintaining a clean codebase.
- **Styling**: Styles are defined using `StyleSheet` from `react-native`, promoting a consistent styling approach across components.

## Integration Points
- **External Dependencies**: The project relies on several Expo libraries (e.g., `expo-router`, `expo-splash-screen`, etc.) for routing and UI components. Ensure these are properly installed and configured in `package.json`.
- **Cross-Component Communication**: Data is fetched in the `HomeScreen` component and passed down to child components as props, facilitating a clear data flow.

## Examples
- **Fetching Data**: The `useEffect` hook in `index.tsx` demonstrates how to fetch device data and update the state accordingly. This pattern is essential for managing asynchronous data in React components.

## Additional Resources
- Refer to the [Expo documentation](https://docs.expo.dev/) for more details on using Expo features and libraries.
- Check the `README.md` for setup instructions and project-specific guidelines.