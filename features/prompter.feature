Feature: Speech-tracked teleprompter
  promptly keeps a presenter on pace using in-browser Whisper, with manual
  and WPM fallbacks, all stored locally.

  Background:
    Given a presenter with a loaded script

  Rule: Sliding-window speech tracking
    @core
    Scenario: Pointer advances with the presenter
      When the presenter speaks the next words in order
      Then the current token moves to the last confirmed word

  @core
  Scenario: Stray filler does not derail
    When the presenter says a filler word unmatched in the script
    Then the pointer holds until real words land

  Rule: Recovery search
  Scenario: The presenter skips to an earlier unique phrase
    Given whole-script recovery is enabled
    When the matcher misses several consecutive words
    And the presented words form a unique phrase in the script
    Then the pointer lands at that phrase's last confirmed word

  Scenario: Repeated passages are ambiguous
    Given the script repeats the detected phrase
    Then the pointer holds and displays "lost position"

  Rule: Manual fallbacks
  Scenario: WPM pacing continues through inference loss
    When the presenter switches to wpm mode
    Then the pointer advances at <wpm> words per minute
    And ArrowUp and ArrowDown adjust <wpm> by 10

  Rule: Hardware teleprompter utilities
  Scenario: Mirror mode flips text but never the controls
    Given mirror mode is enabled
    Then the script column renders mirrored
    And the control bar renders normally

  Scenario: OLED pure black hides display glow
    Given pureBlack is enabled
    Then the prompter background is #000000

  Rule: Autosave and progress
  Scenario: Edits autosave and reset reading position
    When the presenter edits script content
    Then the script saves within a second
    And the reading position resets to the start

  Scenario: Renaming keeps position
    When the presenter renames the script
    Then the reading position is preserved

  Rule: Privacy and lifecycle
  Scenario: Nothing leaves the device
    Given any use of the app
    Then scripts and audio stay in browser storage
    And the only outbound traffic is Whisper model files

  Scenario: Backgrounding releases microphone and wake lock
    When the app is hidden
    Then microphone capture stops
