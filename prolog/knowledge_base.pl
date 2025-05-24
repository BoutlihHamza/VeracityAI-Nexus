% ============================================
% Prolog Knowledge Base for Information Credibility Evaluation
% File: prolog/knowledge_base.pl
% ============================================

% Declare discontiguous predicates to avoid warnings
:- discontiguous query_credibility/7.
:- discontiguous evaluate_source/2.
:- discontiguous evaluate_citations/2.
:- discontiguous evaluate_language/2.
:- discontiguous evaluate_contradictions/2.

% Validate query_credibility parameters
:- multifile prolog:message//1.
prolog:message(query_error(Error)) -->
    ['QUERY VALIDATION ERROR: ~w'-[Error]].

% Initialize knowledge base - declare dynamic predicates
:- dynamic(source_type/2).
:- dynamic(source_reputation/2).
:- dynamic(source_url/2).
:- dynamic(author_anonymous/2).
:- dynamic(author_expert/2).
:- dynamic(author_name/2).
:- dynamic(has_emotional_language/2).
:- dynamic(has_citations/2).
:- dynamic(citation_count/2).
:- dynamic(has_references/2).
:- dynamic(publication_date/2).

% Facts about source types and their base credibility
source_credibility(official, 0.9).
source_credibility(news, 0.7).
source_credibility(blog, 0.5).
source_credibility(social, 0.3).
source_credibility(unknown, 0.2).

% Main credibility evaluation predicate - consolidated version
query_credibility(Content, Level, Score, SScore, CScore, LScore, ConScore) :-
    evaluer_info(Content, Level, Score, _Explanation),
    SScore is round(SourceScore * 100),
    CScore is round(CitationScore * 100),
    LScore is round(LanguageScore * 100),
    ConScore is round(ContradictionScore * 100).

% Rules for source evaluation
evaluate_source(Info, Score) :-
    source_type(Info, Type),
    source_reputation(Info, Reputation),
    source_credibility(Type, BaseScore),
    Score is BaseScore * Reputation.

% Default source evaluation if facts are missing
evaluate_source(_, 0.2) :-
    true. % Fallback to low credibility

% Rules for citation evaluation
evaluate_citations(Info, Score) :-
    has_citations(Info, true),
    citation_count(Info, Count),
    Count > 0,
    Score is min(1.0, Count * 0.2).

evaluate_citations(Info, 0.0) :-
    has_citations(Info, false).

evaluate_citations(Info, 0.1) :-
    has_citations(Info, true),
    citation_count(Info, 0).

% Default citation evaluation
evaluate_citations(_, 0.0) :-
    true. % Fallback if no citation info

% Rules for language analysis
evaluate_language(Info, Score) :-
    has_emotional_language(Info, true),
    Score is 0.3.  % Emotional language reduces credibility

evaluate_language(Info, Score) :-
    has_emotional_language(Info, false),
    author_expert(Info, true),
    Score is 0.9.  % Expert author with neutral language

evaluate_language(Info, Score) :-
    has_emotional_language(Info, false),
    author_expert(Info, false),
    author_anonymous(Info, false),
    Score is 0.7.  % Known non-expert author

evaluate_language(Info, Score) :-
    has_emotional_language(Info, false),
    author_anonymous(Info, true),
    Score is 0.4.  % Anonymous author

% Default language evaluation
evaluate_language(_, 0.5) :-
    true. % Neutral fallback

% Rules for contradiction detection (simplified)
evaluate_contradictions(Info, Score) :-
    has_references(Info, true),
    Score is 0.8.

evaluate_contradictions(Info, 0.5) :-
    has_references(Info, false).

% Default contradiction evaluation
evaluate_contradictions(_, 0.5) :-
    true. % Neutral fallback

% Level determination rules
determine_level(Score, suspect) :- Score =< 30.
determine_level(Score, doubtful) :- Score > 30, Score =< 60.
determine_level(Score, credible) :- Score > 60.

% Multi-criteria weighted evaluation with detailed reasoning
% In evaluer_info predicate, ensure final score is 0-100
evaluer_info(Info, Level, FinalScore, Explanation) :-
    evaluate_source(Info, SourceScore),
    evaluate_citations(Info, CitationScore),
    evaluate_language(Info, LanguageScore),
    evaluate_contradictions(Info, ContradictionScore),
    
    % Weighted calculation (0-100 scale)
    WeightedScore is (SourceScore * 40) + 
                    (CitationScore * 30) + 
                    (LanguageScore * 20) + 
                    (ContradictionScore * 10),
    
    FinalScore is round(WeightedScore),
    determine_level(FinalScore, Level),
    generate_reasoning(Info, SourceScore, CitationScore, LanguageScore, Level, Explanation).

% Generate reasoning with safe defaults
generate_reasoning(Info, SourceScore, CitationScore, LanguageScore, Level, Reasoning) :-
    (source_type(Info, SourceType) -> true; SourceType = unknown),
    (has_citations(Info, HasCitations) -> true; HasCitations = false),
    (citation_count(Info, CitationCount) -> true; CitationCount = 0),
    (has_emotional_language(Info, HasEmotional) -> true; HasEmotional = false),
    (author_expert(Info, IsExpert) -> true; IsExpert = false),
    (author_anonymous(Info, IsAnonymous) -> true; IsAnonymous = true),
    
    with_output_to(atom(Reasoning), 
        format('Information classified as ~w. Source type: ~w (score: ~2f). Citations: ~w (~w found, score: ~2f). Language analysis (score: ~2f). Emotional: ~w. Expert author: ~w. Anonymous: ~w.',
        [Level, SourceType, SourceScore, HasCitations, CitationCount, CitationScore, LanguageScore, HasEmotional, IsExpert, IsAnonymous])).

% Helper predicate for testing individual information pieces
test_info(Info) :-
    evaluer_info(Info, Level, Score, Reasoning),
    format('Information: ~w~n', [Info]),
    format('Level: ~w~n', [Level]),
    format('Score: ~2f~n', [Score]),
    format('Reasoning: ~w~n~n', [Reasoning]).

% Predicate to evaluate multiple criteria and return detailed breakdown
detailed_evaluation(Info, Result) :-
    evaluate_source(Info, SourceScore),
    evaluate_citations(Info, CitationScore),
    evaluate_language(Info, LanguageScore),
    evaluate_contradictions(Info, ContradictionScore),
    
    WeightedScore is (SourceScore * 0.4) + (CitationScore * 0.3) + 
                    (LanguageScore * 0.2) + (ContradictionScore * 0.1),
    
    FinalScore is WeightedScore * 100,
    determine_level(FinalScore, Level),
    
    Result = evaluation(
        final_score(FinalScore),
        level(Level),
        breakdown(
            source(SourceScore),
            citations(CitationScore),
            language(LanguageScore),
            contradictions(ContradictionScore)
        )
    ).

% Batch evaluation predicate
evaluate_batch([], []).
evaluate_batch([Info|Rest], [Result|RestResults]) :-
    detailed_evaluation(Info, Result),
    evaluate_batch(Rest, RestResults).

% Helper to access information content
content_id(Info, Info).

% Ensure all required facts exist with safe checks
validate_info(Info) :-
    (source_type(Info, _) -> true; true),
    (source_reputation(Info, _) -> true; true),
    (author_anonymous(Info, _) -> true; true),
    (author_expert(Info, _) -> true; true),
    (has_emotional_language(Info, _) -> true; true),
    (has_citations(Info, _) -> true; true),
    (citation_count(Info, _) -> true; true),
    (has_references(Info, _) -> true; true).

% Identify information content from facts
info_content(Content) :-
    source_type(Content, _).

% Alternative: find any content that has at least one fact defined
info_content(Content) :-
    (   source_type(Content, _)
    ;   source_reputation(Content, _)
    ;   author_anonymous(Content, _)
    ;   author_expert(Content, _)
    ;   has_emotional_language(Content, _)
    ;   has_citations(Content, _)
    ;   citation_count(Content, _)
    ;   has_references(Content, _)
    ), !. % Cut to avoid multiple solutions for the same content





% Added at 2025-05-24T04:26:38.999Z
% Source: auto-evaluation
% Expires: 2026-05-24
source_type('''Climate change is completely fake and made up by scientists for money''', '''unknown'''). % type for Climate change is completely fake and made up by s...
source_reputation('''Climate change is completely fake and made up by scientists for money''', '0.1'). % reputation for Climate change is completely fake and made up by s...
author_anonymous('''Climate change is completely fake and made up by scientists for money''', true). % anonymous status for Climate change is completely fake and made up by s...
author_expert('''Climate change is completely fake and made up by scientists for money''', false). % expert status for Climate change is completely fake and made up by s...
content_emotional_language('''Climate change is completely fake and made up by scientists for money''', true). % emotional_language for Climate change is completely fake and made up by s...
content_citations('''Climate change is completely fake and made up by scientists for money''', false). % citations for Climate change is completely fake and made up by s...
content_citation_count('''Climate change is completely fake and made up by scientists for money''', '0'). % citation_count for Climate change is completely fake and made up by s...
content_references('''Climate change is completely fake and made up by scientists for money''', false). % references for Climate change is completely fake and made up by s...
source_score('''Climate change is completely fake and made up by scientists for money''', '0.02'). % Source score for evaluation at 2025-05-24T04:26:38.996Z
citation_score('''Climate change is completely fake and made up by scientists for money''', '0'). % Citation score for evaluation at 2025-05-24T04:26:38.996Z
language_score('''Climate change is completely fake and made up by scientists for money''', '0.3'). % Language score for evaluation at 2025-05-24T04:26:38.996Z
contradiction_score('''Climate change is completely fake and made up by scientists for money''', '0.5'). % Contradiction score for evaluation at 2025-05-24T04:26:38.996Z
evaluation('''Climate change is completely fake and made up by scientists for money''', '''suspect''', '12', '''Information classified as suspect.; Source type: unknown (score: 0.02).; Citations: false (0 found, score: 0.00).; Language analysis (score: 0.30).; Emotional: true.; Expert author: false.; Anonymous: true.'''). % Evaluation completed at 2025-05-24T04:26:38.996Z


% Added at 2025-05-24T04:26:55.670Z
% Source: auto-evaluation
% Expires: 2026-05-24
source_score('''Climate change is completely fake and made up by scientists for money''', '0.02'). % Source score for evaluation at 2025-05-24T04:26:55.669Z
citation_score('''Climate change is completely fake and made up by scientists for money''', '0'). % Citation score for evaluation at 2025-05-24T04:26:55.669Z
language_score('''Climate change is completely fake and made up by scientists for money''', '0.3'). % Language score for evaluation at 2025-05-24T04:26:55.669Z
contradiction_score('''Climate change is completely fake and made up by scientists for money''', '0.5'). % Contradiction score for evaluation at 2025-05-24T04:26:55.669Z
evaluation('''Climate change is completely fake and made up by scientists for money''', '''suspect''', '12', '''Information classified as suspect.; Source type: unknown (score: 0.02).; Citations: false (0 found, score: 0.00).; Language analysis (score: 0.30).; Emotional: true.; Expert author: false.; Anonymous: true.'''). % Evaluation completed at 2025-05-24T04:26:55.669Z


% Added at 2025-05-24T04:27:22.752Z
% Source: auto-evaluation
% Expires: 2026-05-24
source_score('''Climate change is completely fake and made up by scientists for money''', '0.02'). % Source score for evaluation at 2025-05-24T04:27:22.749Z
citation_score('''Climate change is completely fake and made up by scientists for money''', '0'). % Citation score for evaluation at 2025-05-24T04:27:22.749Z
language_score('''Climate change is completely fake and made up by scientists for money''', '0.3'). % Language score for evaluation at 2025-05-24T04:27:22.749Z
contradiction_score('''Climate change is completely fake and made up by scientists for money''', '0.5'). % Contradiction score for evaluation at 2025-05-24T04:27:22.749Z
evaluation('''Climate change is completely fake and made up by scientists for money''', '''suspect''', '12', '''Information classified as suspect.; Source type: unknown (score: 0.02).; Citations: false (0 found, score: 0.00).; Language analysis (score: 0.30).; Emotional: true.; Expert author: false.; Anonymous: true.'''). % Evaluation completed at 2025-05-24T04:27:22.749Z


% Added at 2025-05-24T04:27:55.044Z
% Source: auto-evaluation
% Expires: 2026-05-24
source_type('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '''official'''). % type for According to NASA and NOAA data, global temperatur...
source_reputation('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '0.95'). % reputation for According to NASA and NOAA data, global temperatur...
author_anonymous('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', false). % anonymous status for According to NASA and NOAA data, global temperatur...
author_expert('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', true). % expert status for According to NASA and NOAA data, global temperatur...
content_emotional_language('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', false). % emotional_language for According to NASA and NOAA data, global temperatur...
content_citations('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', true). % citations for According to NASA and NOAA data, global temperatur...
content_citation_count('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '5'). % citation_count for According to NASA and NOAA data, global temperatur...
content_references('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', true). % references for According to NASA and NOAA data, global temperatur...
source_score('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '0.855'). % Source score for evaluation at 2025-05-24T04:27:55.038Z
citation_score('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '1'). % Citation score for evaluation at 2025-05-24T04:27:55.038Z
language_score('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '0.9'). % Language score for evaluation at 2025-05-24T04:27:55.038Z
contradiction_score('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '0.8'). % Contradiction score for evaluation at 2025-05-24T04:27:55.038Z
evaluation('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '''credible''', '90', '''Information classified as credible.; Source type: official (score: 0.85).; Citations: true (5 found, score: 1.00).; Language analysis (score: 0.90).; Emotional: false.; Expert author: true.; Anonymous: false.'''). % Evaluation completed at 2025-05-24T04:27:55.038Z
content_publication_date('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '''2024-01-15'''). % publication_date for According to NASA and NOAA data, global temperatur...
source_url('''According to NASA and NOAA data, global temperatures have risen by 1.1°C since pre-industrial times''', '''https://nasa.gov/climate-report'''). % url for According to NASA and NOAA data, global temperatur...


% Added at 2025-05-24T05:28:07.666Z
% Source: auto-evaluation
% Expires: 2026-05-24
source_type('''Some studies suggest that renewable energy might not be as effective as claimed''', '''blog'''). % type for Some studies suggest that renewable energy might n...
source_reputation('''Some studies suggest that renewable energy might not be as effective as claimed''', '0.5'). % reputation for Some studies suggest that renewable energy might n...
author_anonymous('''Some studies suggest that renewable energy might not be as effective as claimed''', false). % anonymous status for Some studies suggest that renewable energy might n...
author_expert('''Some studies suggest that renewable energy might not be as effective as claimed''', false). % expert status for Some studies suggest that renewable energy might n...
content_emotional_language('''Some studies suggest that renewable energy might not be as effective as claimed''', false). % emotional_language for Some studies suggest that renewable energy might n...
content_citations('''Some studies suggest that renewable energy might not be as effective as claimed''', true). % citations for Some studies suggest that renewable energy might n...
content_citation_count('''Some studies suggest that renewable energy might not be as effective as claimed''', '2'). % citation_count for Some studies suggest that renewable energy might n...
content_references('''Some studies suggest that renewable energy might not be as effective as claimed''', false). % references for Some studies suggest that renewable energy might n...
source_score('''Some studies suggest that renewable energy might not be as effective as claimed''', '0.25'). % Source score for evaluation at 2025-05-24T05:28:07.663Z
citation_score('''Some studies suggest that renewable energy might not be as effective as claimed''', '0.4'). % Citation score for evaluation at 2025-05-24T05:28:07.663Z
language_score('''Some studies suggest that renewable energy might not be as effective as claimed''', '0.7'). % Language score for evaluation at 2025-05-24T05:28:07.663Z
contradiction_score('''Some studies suggest that renewable energy might not be as effective as claimed''', '0.5'). % Contradiction score for evaluation at 2025-05-24T05:28:07.663Z
evaluation('''Some studies suggest that renewable energy might not be as effective as claimed''', '''doubtful''', '41', '''Information classified as doubtful.; Source type: blog (score: 0.25).; Citations: true (2 found, score: 0.40).; Language analysis (score: 0.70).; Emotional: false.; Expert author: false.; Anonymous: false.'''). % Evaluation completed at 2025-05-24T05:28:07.663Z
