# Requirements Document

## Introduction

This feature addresses a critical bug in the source switching system where invalid URL types (numbers instead of strings) cause unrecoverable player errors without triggering the manual recovery dialog. The system must validate URL types before switching and provide proper error handling with user recovery options.

## Glossary

- **SourceSwitchExecutor**: The component responsible for executing video source switches and managing player state transitions
- **AutoSourceSwitcher**: The orchestrator component that coordinates automatic source switching based on loading conditions
- **PlayerRecoveryManager**: The component that handles player rebuilding and recovery from fatal errors
- **TargetSource**: The video source object being switched to, containing URL and metadata
- **Manual Recovery Dialog**: A UI component that allows users to manually fix player errors when automatic recovery fails

## Requirements

### Requirement 1

**User Story:** As a video viewer, I want the player to validate source URLs before switching, so that I don't encounter unrecoverable type errors

#### Acceptance Criteria

1. WHEN the SourceSwitchExecutor receives a switch request, THE SourceSwitchExecutor SHALL validate that the target URL is a string type
2. IF the target URL is not a string type, THEN THE SourceSwitchExecutor SHALL reject the switch with a descriptive error message
3. WHEN URL validation fails, THE SourceSwitchExecutor SHALL log the invalid URL value and its type for debugging
4. THE SourceSwitchExecutor SHALL ensure episodeUrl takes precedence over url property when both exist
5. IF both episodeUrl and url are invalid or missing, THEN THE SourceSwitchExecutor SHALL return a validation error

### Requirement 2

**User Story:** As a video viewer, I want to see a manual recovery dialog when source switching fails, so that I can attempt to fix the issue without refreshing the page

#### Acceptance Criteria

1. WHEN a source switch fails due to URL validation errors, THE AutoSourceSwitcher SHALL trigger the manual recovery flow
2. WHEN a source switch fails due to player errors during execution, THE AutoSourceSwitcher SHALL trigger the manual recovery flow
3. THE AutoSourceSwitcher SHALL pass the error context to the PlayerRecoveryManager including error type and failed source information
4. WHEN all automatic recovery attempts are exhausted, THE PlayerRecoveryManager SHALL display the manual recovery dialog
5. THE manual recovery dialog SHALL provide options to retry with a different source or reload the page

### Requirement 3

**User Story:** As a developer, I want comprehensive error logging for source switching failures, so that I can diagnose and fix issues quickly

#### Acceptance Criteria

1. WHEN URL validation fails, THE SourceSwitchExecutor SHALL log the complete targetSource object structure
2. WHEN a switch fails, THE AutoSourceSwitcher SHALL log the switch context including current source, target source, and reason
3. THE SourceSwitchExecutor SHALL log the player state at the time of failure
4. WHEN an unhandled rejection occurs, THE system SHALL capture and log the full error stack trace
5. THE system SHALL include timestamps in all error logs for correlation

### Requirement 4

**User Story:** As a video viewer, I want the system to gracefully handle source data inconsistencies, so that playback continues even when some sources have malformed data

#### Acceptance Criteria

1. WHEN the AutoSourceSwitcher evaluates sources, THE AutoSourceSwitcher SHALL filter out sources with invalid URL types
2. THE EnhancedSourceSelector SHALL mark sources with invalid URLs as unavailable
3. WHEN all sources fail validation, THE AutoSourceSwitcher SHALL notify the user with a clear error message
4. THE system SHALL continue attempting to use valid sources even if some sources in the list are invalid
5. THE SourceSwitchExecutor SHALL sanitize and normalize URL values before passing them to the player
