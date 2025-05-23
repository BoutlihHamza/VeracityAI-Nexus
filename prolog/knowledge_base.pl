% ============================================================================
% KNOWLEDGE BASE FOR INFORMATION CREDIBILITY EVALUATION EXPERT SYSTEM
% Système Expert pour l'Évaluation de la Fiabilité des Informations
% ============================================================================

% ----------------------------------------------------------------------------
% 1. FACTS - Base de connaissances (Faits)
% ----------------------------------------------------------------------------

% Source reputation facts
source_reputation(official_gov, 0.9).
source_reputation(academic, 0.85).
source_reputation(news_major, 0.7).
source_reputation(news_local, 0.6).
source_reputation(blog_expert, 0.5).
source_reputation(social_media, 0.3).
source_reputation(anonymous, 0.2).
source_reputation(unknown, 0.1).

% Author credibility facts
author_credibility(expert_verified, 0.9).
author_credibility(academic, 0.8).
author_credibility(journalist_verified, 0.7).
author_credibility(known_professional, 0.6).
author_credibility(regular_contributor, 0.4).
author_credibility(anonymous_credible, 0.3).
author_credibility(anonymous_unknown, 0.1).

% Language style indicators
emotional_language_penalty(high, 0.3).
emotional_language_penalty(medium, 0.2).
emotional_language_penalty(low, 0.1).
emotional_language_penalty(none, 0.0).

% Citation quality weights
citation_weight(peer_reviewed, 0.9).
citation_weight(official_source, 0.8).
citation_weight(news_source, 0.6).
citation_weight(blog_reference, 0.4).
citation_weight(social_reference, 0.2).
citation_weight(no_citation, 0.0).

% Contradiction levels
contradiction_impact(none, 0.0).
contradiction_impact(minor, 0.1).
contradiction_impact(moderate, 0.3).
contradiction_impact(major, 0.5).
contradiction_impact(severe, 0.7).

% Content type modifiers
content_type_modifier(scientific, 0.1).
content_type_modifier(news, 0.0).
content_type_modifier(opinion, -0.1).
content_type_modifier(advertisement, -0.3).

% ----------------------------------------------------------------------------
% 2. RULES - Règles d'inférence (Rules)
% ----------------------------------------------------------------------------

% Main evaluation rule - Point d'entrée principal
evaluate_information_credibility(Info, Result) :-
    extract_info_components(Info, Source, Author, Content, Citations, Language, Contradictions),
    calculate_source_score(Source, SourceScore),
    calculate_author_score(Author, AuthorScore),
    calculate_citation_score(Citations, CitationScore),
    calculate_language_score(Language, LanguageScore),
    calculate_contradiction_score(Contradictions, ContraScore),
    combine_scores([SourceScore, AuthorScore, CitationScore, LanguageScore, ContraScore], 
                  [0.4, 0.2, 0.2, 0.1, 0.1], FinalScore),
    determine_credibility_level(FinalScore, Level),
    generate_explanation(SourceScore, AuthorScore, CitationScore, LanguageScore, ContraScore, Level, Explanation),
    Result = credibility(FinalScore, Level, Explanation).

% Source evaluation rules
calculate_source_score(Source, Score) :-
    source_type(Source, Type),
    source_reputation(Type, BaseScore),
    source_age(Source, Age),
    apply_age_factor(BaseScore, Age, Score).

source_type(source(Type, _, _), Type).
source_age(source(_, Age, _), Age).

apply_age_factor(BaseScore, Age, Score) :-
    (Age > 365 -> AgeFactor = 0.9;
     Age > 180 -> AgeFactor = 0.95;
     AgeFactor = 1.0),
    Score is BaseScore * AgeFactor.

% Author evaluation rules
calculate_author_score(Author, Score) :-
    author_type(Author, Type),
    author_credibility(Type, BaseScore),
    author_anonymity(Author, IsAnon),
    apply_anonymity_penalty(BaseScore, IsAnon, Score).

author_type(author(Type, _, _), Type).
author_anonymity(author(_, _, IsAnon), IsAnon).

apply_anonymity_penalty(BaseScore, true, Score) :-
    Score is BaseScore * 0.7.
apply_anonymity_penalty(BaseScore, false, BaseScore).

% Citation evaluation rules
calculate_citation_score(Citations, Score) :-
    citation_count(Citations, Count),
    citation_quality(Citations, Quality),
    citation_weight(Quality, QualityWeight),
    calculate_count_bonus(Count, CountBonus),
    Score is (QualityWeight + CountBonus) / 2.

citation_count(citations(Count, _), Count).
citation_quality(citations(_, Quality), Quality).

calculate_count_bonus(Count, Bonus) :-
    (Count >= 5 -> Bonus = 1.0;
     Count >= 3 -> Bonus = 0.8;
     Count >= 1 -> Bonus = 0.6;
     Bonus = 0.0).

% Language analysis rules
calculate_language_score(Language, Score) :-
    emotional_level(Language, EmotionalLevel),
    emotional_language_penalty(EmotionalLevel, Penalty),
    language_clarity(Language, Clarity),
    BaseScore is 1.0 - Penalty,
    Score is BaseScore * Clarity.

emotional_level(language(Emotional, _), Emotional).
language_clarity(language(_, Clarity), Clarity).

% Contradiction analysis rules
calculate_contradiction_score(Contradictions, Score) :-
    contradiction_level(Contradictions, Level),
    contradiction_impact(Level, Impact),
    Score is 1.0 - Impact.

contradiction_level(contradictions(Level), Level).

% Score combination rule with weights
combine_scores([], [], 0).
combine_scores([Score|ScoreRest], [Weight|WeightRest], Result) :-
    combine_scores(ScoreRest, WeightRest, RestResult),
    Result is Score * Weight + RestResult.

% Credibility level determination
determine_credibility_level(Score, Level) :-
    ScorePercent is Score * 100,
    (ScorePercent >= 61 -> Level = credible;
     ScorePercent >= 31 -> Level = doubtful;
     Level = suspect).

% ----------------------------------------------------------------------------
% 3. INFERENCE ENGINE - Moteur d'inférence
% ----------------------------------------------------------------------------

% Forward chaining for automatic fact derivation
derive_facts(Info, DerivedFacts) :-
    findall(Fact, (
        derive_single_fact(Info, Fact),
        \+ member(Fact, Info)
    ), DerivedFacts).

derive_single_fact(Info, newly_published) :-
    member(publication_date(Date), Info),
    get_time(Now),
    DaysDiff is (Now - Date) / 86400,
    DaysDiff < 7.

derive_single_fact(Info, outdated_content) :-
    member(publication_date(Date), Info),
    get_time(Now),
    DaysDiff is (Now - Date) / 86400,
    DaysDiff > 365.

derive_single_fact(Info, well_cited) :-
    member(citation_count(Count), Info),
    Count >= 5.

derive_single_fact(Info, poorly_cited) :-
    member(citation_count(Count), Info),
    Count < 1.

% Backward chaining for goal-driven queries
query_credibility(Goal, Info, Result) :-
    (Goal = credibility_level -> 
        evaluate_information_credibility(Info, credibility(_, Level, _)),
        Result = Level
    ;
    Goal = credibility_score ->
        evaluate_information_credibility(Info, credibility(Score, _, _)),
        Result = Score
    ;
    Goal = explanation ->
        evaluate_information_credibility(Info, credibility(_, _, Explanation)),
        Result = Explanation
    ).

% ----------------------------------------------------------------------------
% 4. EXPLANATION GENERATION - Génération d'explications
% ----------------------------------------------------------------------------

generate_explanation(SourceScore, AuthorScore, CitationScore, LanguageScore, ContraScore, Level, Explanation) :-
    format_scores(SourceScore, AuthorScore, CitationScore, LanguageScore, ContraScore, FormattedScores),
    generate_level_explanation(Level, LevelExplanation),
    identify_strengths([SourceScore, AuthorScore, CitationScore, LanguageScore, ContraScore], 
                      ['source', 'author', 'citations', 'language', 'contradictions'], Strengths),
    identify_weaknesses([SourceScore, AuthorScore, CitationScore, LanguageScore, ContraScore], 
                       ['source', 'author', 'citations', 'language', 'contradictions'], Weaknesses),
    Explanation = explanation(FormattedScores, LevelExplanation, Strengths, Weaknesses).

format_scores(S1, S2, S3, S4, S5, formatted_scores(S1, S2, S3, S4, S5)).

generate_level_explanation(credible, 'Information classée comme CRÉDIBLE - Score élevé dans la majorité des critères').
generate_level_explanation(doubtful, 'Information classée comme DOUTEUSE - Score moyen, vérification recommandée').
generate_level_explanation(suspect, 'Information classée comme SUSPECTE - Score faible, sources peu fiables').

identify_strengths(Scores, Labels, Strengths) :-
    pair_scores_labels(Scores, Labels, Pairs),
    include(is_strength, Pairs, StrengthPairs),
    extract_labels(StrengthPairs, Strengths).

identify_weaknesses(Scores, Labels, Weaknesses) :-
    pair_scores_labels(Scores, Labels, Pairs),
    include(is_weakness, Pairs, WeaknessPairs),
    extract_labels(WeaknessPairs, Weaknesses).

pair_scores_labels([], [], []).
pair_scores_labels([Score|Scores], [Label|Labels], [Score-Label|Pairs]) :-
    pair_scores_labels(Scores, Labels, Pairs).

is_strength(Score-_) :- Score > 0.7.
is_weakness(Score-_) :- Score < 0.4.

extract_labels([], []).
extract_labels([_-Label|Pairs], [Label|Labels]) :-
    extract_labels(Pairs, Labels).

% ----------------------------------------------------------------------------
% 5. UTILITY PREDICATES - Prédicats utilitaires
% ----------------------------------------------------------------------------

% Extract information components from structured input
extract_info_components(Info, Source, Author, Content, Citations, Language, Contradictions) :-
    member(source(SourceType, SourceAge, SourceRep), Info),
    Source = source(SourceType, SourceAge, SourceRep),
    member(author(AuthorType, AuthorCred, AuthorAnon), Info),
    Author = author(AuthorType, AuthorCred, AuthorAnon),
    member(content(ContentText), Info),
    Content = content(ContentText),
    member(citations(CitCount, CitQuality), Info),
    Citations = citations(CitCount, CitQuality),
    member(language(EmotLevel, Clarity), Info),
    Language = language(EmotLevel, Clarity),
    member(contradictions(ContraLevel), Info),
    Contradictions = contradictions(ContraLevel).

% Test cases and examples
test_case_1(Info) :-
    Info = [
        source(academic, 30, 0.85),
        author(expert_verified, 0.9, false),
        content("Scientific study on climate change with peer review"),
        citations(8, peer_reviewed),
        language(none, 0.9),
        contradictions(none)
    ].

test_case_2(Info) :-
    Info = [
        source(social_media, 1, 0.3),
        author(anonymous_unknown, 0.1, true),
        content("Breaking news without verification"),
        citations(0, no_citation),
        language(high, 0.5),
        contradictions(major)
    ].

test_case_3(Info) :-
    Info = [
        source(news_major, 2, 0.7),
        author(journalist_verified, 0.7, false),
        content("Political analysis with mixed sources"),
        citations(3, news_source),
        language(medium, 0.7),
        contradictions(minor)
    ].

% Query interface predicates
evaluate_test_case(CaseNumber, Result) :-
    (CaseNumber = 1 -> test_case_1(Info);
     CaseNumber = 2 -> test_case_2(Info);
     CaseNumber = 3 -> test_case_3(Info);
     fail),
    evaluate_information_credibility(Info, Result).

% Interactive consultation interface
start_consultation :-
    write('=== Système Expert d\'Évaluation de Crédibilité ==='), nl,
    write('Veuillez fournir les informations suivantes:'), nl,
    collect_source_info(Source),
    collect_author_info(Author),
    collect_content_info(Content),
    collect_citation_info(Citations),
    collect_language_info(Language),
    collect_contradiction_info(Contradictions),
    Info = [Source, Author, Content, Citations, Language, Contradictions],
    evaluate_information_credibility(Info, Result),
    display_result(Result).

% Helper predicates for interactive consultation
collect_source_info(source(Type, Age, Rep)) :-
    write('Type de source (official_gov/academic/news_major/news_local/blog_expert/social_media/anonymous/unknown): '),
    read(Type),
    write('Âge en jours: '),
    read(Age),
    source_reputation(Type, Rep).

collect_author_info(author(Type, Cred, IsAnon)) :-
    write('Type d\'auteur (expert_verified/academic/journalist_verified/known_professional/regular_contributor/anonymous_credible/anonymous_unknown): '),
    read(Type),
    write('Auteur anonyme? (true/false): '),
    read(IsAnon),
    author_credibility(Type, Cred).

collect_content_info(content(Text)) :-
    write('Contenu de l\'information: '),
    read_line_to_codes(user_input, Codes),
    string_codes(Text, Codes).

collect_citation_info(citations(Count, Quality)) :-
    write('Nombre de citations: '),
    read(Count),
    write('Qualité des citations (peer_reviewed/official_source/news_source/blog_reference/social_reference/no_citation): '),
    read(Quality).

collect_language_info(language(EmotLevel, Clarity)) :-
    write('Niveau émotionnel (none/low/medium/high): '),
    read(EmotLevel),
    write('Clarté du langage (0.0-1.0): '),
    read(Clarity).

collect_contradiction_info(contradictions(Level)) :-
    write('Niveau de contradiction (none/minor/moderate/major/severe): '),
    read(Level).

display_result(credibility(Score, Level, Explanation)) :-
    format('~n=== RÉSULTAT DE L\'ÉVALUATION ===~n'),
    format('Score de crédibilité: ~2f/1.0 (~0f%)~n', [Score, Score*100]),
    format('Niveau: ~w~n', [Level]),
    write('Explication: '), write(Explanation), nl.

% ----------------------------------------------------------------------------
% 6. ADDITIONAL INFERENCE RULES
% ----------------------------------------------------------------------------

% Rules for dynamic knowledge base updates
add_source_reputation(SourceType, Reputation) :-
    assertz(source_reputation(SourceType, Reputation)).

update_source_reputation(SourceType, NewReputation) :-
    retract(source_reputation(SourceType, _)),
    assertz(source_reputation(SourceType, NewReputation)).

% Rules for learning from user feedback
learn_from_feedback(InfoData, UserRating, SystemRating) :-
    Difference is abs(UserRating - SystemRating),
    (Difference > 0.3 ->
        adjust_weights(InfoData, UserRating, SystemRating);
        true).

adjust_weights(InfoData, UserRating, SystemRating) :-
    % This would implement weight adjustment based on feedback
    % For now, just log the discrepancy
    format('Learning opportunity: User rated ~2f, System rated ~2f~n', [UserRating, SystemRating]).

% Batch evaluation for multiple information pieces
evaluate_batch(InfoList, Results) :-
    maplist(evaluate_information_credibility, InfoList, Results).

% Export results to structured format
export_evaluation(Info, Result, json(JSONResult)) :-
    Result = credibility(Score, Level, Explanation),
    JSONResult = [
        score-Score,
        level-Level,
        explanation-Explanation,
        timestamp-Now
    ],
    get_time(Now).

% ============================================================================
% END OF KNOWLEDGE BASE
% ============================================================================