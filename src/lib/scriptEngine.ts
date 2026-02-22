import { supabase } from './supabase';
import type { EpisodeScript } from './types';
import { getUserId } from './auth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface ScriptTemplate {
  hook_question: string;
  guest_answer: string;
  follow_up_question: string;
  follow_up_answer: string;
  reaction_line: string;
  close_punchline: string;
}

const SCRIPT_TEMPLATES: Record<string, ScriptTemplate[]> = {
  money: [
    {
      hook_question: "What's the most money you've ever made in a single day?",
      guest_answer: "Honestly? Probably like five grand day trading crypto back in 2021. Lost most of it the next week though.",
      follow_up_question: "Would you do it again?",
      follow_up_answer: "In a heartbeat. You gotta risk it to get the biscuit.",
      reaction_line: "That's either confidence or denial, I can't tell.",
      close_punchline: "Risk it to get the biscuit - that's a TAKE!",
    },
    {
      hook_question: "Be honest - how much do you spend on coffee every month?",
      guest_answer: "Probably like two hundred bucks? I know, I know, but I need my oat milk lattes.",
      follow_up_question: "That's like 2400 a year!",
      follow_up_answer: "Worth every penny. Sleep is for the weak, caffeine is for the winners.",
      reaction_line: "She said caffeine is for winners!",
      close_punchline: "Oat milk lattes over rent - now THAT'S a take!",
    },
    {
      hook_question: "What would you do with a million dollars right now?",
      guest_answer: "Pay off my mom's house, then probably blow like fifty K on the dumbest vacation ever.",
      follow_up_question: "Define dumbest vacation.",
      follow_up_answer: "Antarctica. I wanna see some penguins. Like, in person.",
      reaction_line: "This man wants to drop fifty grand on PENGUINS.",
      close_punchline: "Penguins over portfolios - that's a TAKE!",
    },
    {
      hook_question: "What's your biggest waste of money this year?",
      guest_answer: "I bought a two thousand dollar espresso machine. I still go to Starbucks every morning.",
      follow_up_question: "Why though?!",
      follow_up_answer: "Because making coffee is work. Buying coffee is a lifestyle.",
      reaction_line: "Two thousand dollar paperweight.",
      close_punchline: "Lifestyle over logic - that's a TAKE!",
    },
    {
      hook_question: "Would you rather have 10 million dollars or start over at 18 with all your current knowledge?",
      guest_answer: "Start over at 18, easy. I'd invest in Bitcoin and Amazon, be a billionaire by 25.",
      follow_up_question: "But what if you mess up the timeline?",
      follow_up_answer: "Then I'd just enjoy being young again. Win-win.",
      reaction_line: "The confidence is immaculate.",
      close_punchline: "Time travel capitalism - that's a TAKE!",
    },
    {
      hook_question: "What's something expensive that's actually worth every penny?",
      guest_answer: "A good mattress. You spend a third of your life sleeping. Invest in that.",
      follow_up_question: "How much did you spend on yours?",
      follow_up_answer: "Three thousand dollars. Best decision I ever made. My back thanks me daily.",
      reaction_line: "Sleep investment is real.",
      close_punchline: "Mattress millionaire mindset - that's a TAKE!",
    },
  ],
  dating: [
    {
      hook_question: "What's the biggest red flag on a first date?",
      guest_answer: "If they're rude to the waiter. Instant deal breaker. Shows who they really are.",
      follow_up_question: "What if the waiter was actually terrible?",
      follow_up_answer: "Doesn't matter. You can be disappointed without being disrespectful.",
      reaction_line: "Character check at the restaurant. I like that.",
      close_punchline: "Waiter test - that's a TAKE!",
    },
    {
      hook_question: "How long should you wait before texting after a first date?",
      guest_answer: "I text them while I'm still on the date. Life's too short to play games.",
      follow_up_question: "Isn't that a bit intense?",
      follow_up_answer: "It's called being authentic. If they can't handle it, they're not my person.",
      reaction_line: "Texting during the date?! Bold move.",
      close_punchline: "Real-time romance - that's definitely a TAKE!",
    },
    {
      hook_question: "Would you date someone who doesn't have social media?",
      guest_answer: "That's actually a green flag now. Means they touch grass.",
      follow_up_question: "But how would you stalk them first?",
      follow_up_answer: "You talk to them! Like our parents did! Revolutionary concept.",
      reaction_line: "She said talk to them - like with words.",
      close_punchline: "No Instagram, no problem - that's a TAKE!",
    },
    {
      hook_question: "What's the most creative way someone has asked you out?",
      guest_answer: "A guy made a whole PowerPoint presentation on why I should date him. Complete with graphs.",
      follow_up_question: "Did it work?",
      follow_up_answer: "We dated for two years. The presentation was that good.",
      reaction_line: "PowerPoint romance is real!",
      close_punchline: "Slides to soulmates - that's a TAKE!",
    },
    {
      hook_question: "What's an instant ick for you?",
      guest_answer: "When someone chews with their mouth open. I can't. It's over immediately.",
      follow_up_question: "Even if they're like, your soulmate?",
      follow_up_answer: "Then they can learn to close their mouth! I'm not unreasonable.",
      reaction_line: "Chewing with your mouth open is a dealbreaker - NOTED.",
      close_punchline: "Manners matter - that's a TAKE!",
    },
    {
      hook_question: "What's something you wish more people did on dating apps?",
      guest_answer: "Actually read my bio before messaging. Don't ask me questions I already answered.",
      follow_up_question: "What's the worst opener you've gotten?",
      follow_up_answer: "Hey. Just hey. Put some effort in, please.",
      reaction_line: "Low effort energy is everywhere.",
      close_punchline: "Read the bio - that's a TAKE!",
    },
    {
      hook_question: "How soon is too soon to say I love you?",
      guest_answer: "There's no timeline. When you feel it, you feel it. Don't hold back.",
      follow_up_question: "What if they don't say it back?",
      follow_up_answer: "Then at least you know where you stand. Better than wondering forever.",
      reaction_line: "Vulnerability is strength.",
      close_punchline: "Say it when you feel it - that's a TAKE!",
    },
  ],
  hottakes: [
    {
      hook_question: "What's your hottest take right now?",
      guest_answer: "Breakfast food is overrated. Eggs are mid. Pancakes are just cake you eat at 8am.",
      follow_up_question: "Woah, you're attacking breakfast?!",
      follow_up_answer: "I said what I said. Give me a burger at 7am and I'm happy.",
      reaction_line: "Burgers for breakfast... I'm not mad at it actually.",
      close_punchline: "Breakfast is cancelled - HOT TAKE!",
    },
    {
      hook_question: "Give me an opinion that would get you cancelled.",
      guest_answer: "New York pizza is overhyped. Chicago deep dish is superior in every way.",
      follow_up_question: "You're saying that in a New York subway?!",
      follow_up_answer: "I'm from Chicago! I stand on business!",
      reaction_line: "This man has a death wish.",
      close_punchline: "Deep dish supremacy - that's a SPICY take!",
    },
    {
      hook_question: "What's something everyone loves that you think is trash?",
      guest_answer: "The Office. I've tried watching it like five times. It's just awkward pauses.",
      follow_up_question: "Michael Scott slander will not be tolerated.",
      follow_up_answer: "That's what she said... see? That's the whole show!",
      reaction_line: "They really came for The Office on camera.",
      close_punchline: "Office hater in the wild - controversial TAKE!",
    },
    {
      hook_question: "What's a hill you're willing to die on?",
      guest_answer: "Cereal is better dry. Milk makes it soggy and ruins the texture.",
      follow_up_question: "That's psychopath behavior!",
      follow_up_answer: "It's called having standards. Try it sometime.",
      reaction_line: "Dry cereal gang exists apparently.",
      close_punchline: "No milk, no problem - CONTROVERSIAL TAKE!",
    },
    {
      hook_question: "What's overrated that everyone pretends to like?",
      guest_answer: "Hiking. Nobody actually enjoys it. You're just walking uphill and pretending it's fun.",
      follow_up_question: "But the views though!",
      follow_up_answer: "I can Google the view from my couch. Same result, less sweat.",
      reaction_line: "Hiking slander on a Monday.",
      close_punchline: "Couch over trails - that's a LAZY take!",
    },
    {
      hook_question: "What's the most overrated city?",
      guest_answer: "LA. It's just traffic, overpriced smoothies, and people talking about their screenplays.",
      follow_up_question: "You just made enemies with half of California.",
      follow_up_answer: "They're stuck in traffic, they won't catch me.",
      reaction_line: "LA catching strays today!",
      close_punchline: "Traffic and dreams - that's an LA TAKE!",
    },
    {
      hook_question: "What's something that's not a flex that people think is a flex?",
      guest_answer: "Working 80 hours a week. That's not dedication, that's exploitation.",
      follow_up_question: "But the grind culture though?",
      follow_up_answer: "Grind culture is just capitalism convincing you to destroy yourself for someone else's profit.",
      reaction_line: "We got deep real quick.",
      close_punchline: "Rest is resistance - that's a TAKE!",
    },
  ],
  personal: [
    {
      hook_question: "What's something you're secretly really good at?",
      guest_answer: "I can solve a Rubik's cube in under two minutes. Learned it during lockdown.",
      follow_up_question: "Do you bring it to parties?",
      follow_up_answer: "Only when I need to impress someone. Works 60% of the time, every time.",
      reaction_line: "Party trick Rubik's cube guy - we all know one.",
      close_punchline: "Cube skills activated - that's a TAKE!",
    },
    {
      hook_question: "What's your biggest irrational fear?",
      guest_answer: "Butterflies. They're unpredictable and they have no respect for personal space.",
      follow_up_question: "Butterflies?! They're like the most peaceful creature!",
      follow_up_answer: "Peaceful? They fly AT your face! It's chaos!",
      reaction_line: "Never thought I'd hear butterfly slander today.",
      close_punchline: "Butterfly phobia - unexpected TAKE!",
    },
    {
      hook_question: "What's your guilty pleasure that you're not ashamed of?",
      guest_answer: "Reality TV. Love Island, Bachelor, all of it. Zero shame.",
      follow_up_question: "You don't think it rots your brain?",
      follow_up_answer: "My brain needed some rotting. It was too smart before.",
      reaction_line: "Reality TV defender in the wild!",
      close_punchline: "Brain rot on purpose - that's a TAKE!",
    },
    {
      hook_question: "What's the weirdest thing you do when you're alone?",
      guest_answer: "I have full conversations with myself. Both sides. Sometimes I argue.",
      follow_up_question: "Who wins the arguments?",
      follow_up_answer: "Depends on the day. Sometimes past me was right, sometimes present me is.",
      reaction_line: "Internal debates are real.",
      close_punchline: "Self-dialogue champion - that's a TAKE!",
    },
    {
      hook_question: "What's a compliment you've never forgotten?",
      guest_answer: "Someone once told me I have main character energy. I think about that daily.",
      follow_up_question: "Do you agree?",
      follow_up_answer: "I'm literally being interviewed in a subway right now. Absolutely.",
      reaction_line: "The confidence jumped out!",
      close_punchline: "Main character confirmed - that's a TAKE!",
    },
    {
      hook_question: "What's something you believed as a kid that you were shocked wasn't true?",
      guest_answer: "That adults had everything figured out. Turns out we're all just improvising.",
      follow_up_question: "When did you realize?",
      follow_up_answer: "Around 25 when I had to Google how to do taxes. Every year.",
      reaction_line: "Adulting is a scam!",
      close_punchline: "Everyone's winging it - that's a TAKE!",
    },
  ],
  career: [
    {
      hook_question: "What's the worst career advice you've ever received?",
      guest_answer: "Follow your passion. My passion is sleeping. Can't monetize that.",
      follow_up_question: "There's gotta be a way though, right?",
      follow_up_answer: "I mean, mattress testing? Professional napping? I'm listening.",
      reaction_line: "Professional napper is a career goal now.",
      close_punchline: "Sleep your way to success - that's a TAKE!",
    },
    {
      hook_question: "Would you take a fifty percent pay cut to work from home forever?",
      guest_answer: "In this economy? Absolutely not. But if you said twenty percent... we're talking.",
      follow_up_question: "What's your price for going back to the office?",
      follow_up_answer: "Triple my salary and free lunch. Every day. Good lunch.",
      reaction_line: "Triple salary AND free lunch - reasonable demands.",
      close_punchline: "Remote work has a price - that's a TAKE!",
    },
    {
      hook_question: "What job would you never do no matter how much it paid?",
      guest_answer: "Anything involving heights. You could offer me a million dollars, I'm not washing skyscraper windows.",
      follow_up_question: "Not even for like, ten million?",
      follow_up_answer: "I can't spend ten million if I'm dead. No deal.",
      reaction_line: "Heights are non-negotiable!",
      close_punchline: "Ground floor only - that's a TAKE!",
    },
    {
      hook_question: "What's the biggest lie on everyone's resume?",
      guest_answer: "Proficient in Excel. Nobody is proficient in Excel. We all just Google formulas.",
      follow_up_question: "You don't know pivot tables?",
      follow_up_answer: "I know how to YouTube pivot tables. That counts.",
      reaction_line: "Excel expertise is a myth!",
      close_punchline: "Google is the real skill - that's a TAKE!",
    },
    {
      hook_question: "What's the most useless meeting you've ever been in?",
      guest_answer: "A meeting about scheduling future meetings. An hour of my life I'll never get back.",
      follow_up_question: "Did you speak up?",
      follow_up_answer: "I was on mute the whole time. Mentally checked out at minute two.",
      reaction_line: "Meeting culture is broken!",
      close_punchline: "This could've been an email - that's a TAKE!",
    },
    {
      hook_question: "What's the best way to ask for a raise?",
      guest_answer: "Don't ask. Show them a competing offer. Money talks, loyalty doesn't.",
      follow_up_question: "That's kind of ruthless though.",
      follow_up_answer: "They'd replace you tomorrow if it saved them money. Play the game.",
      reaction_line: "Corporate truth bomb!",
      close_punchline: "Know your worth - that's a TAKE!",
    },
  ],
  philosophy: [
    {
      hook_question: "If you could know the answer to one question about life, what would it be?",
      guest_answer: "Are we alone in the universe? Not for aliens, just for closure.",
      follow_up_question: "What if the answer is yes, we're alone?",
      follow_up_answer: "Then we better stop fighting and figure this out together.",
      reaction_line: "That got deep real quick.",
      close_punchline: "Cosmic perspective - that's a TAKE!",
    },
    {
      hook_question: "What do you think happens when we die?",
      guest_answer: "I think we become stories. The people who loved us keep us alive in their memories.",
      follow_up_question: "That's beautiful. What if no one remembers you?",
      follow_up_answer: "Then I better start being more memorable, huh?",
      reaction_line: "Be memorable - noted.",
      close_punchline: "Live to be remembered - that's a TAKE!",
    },
    {
      hook_question: "What's the meaning of life in one sentence?",
      guest_answer: "Find people who make the chaos worth it and hold onto them.",
      follow_up_question: "That's actually really sweet.",
      follow_up_answer: "I have my moments between all the bad decisions.",
      reaction_line: "Wisdom dropped casually on a Tuesday.",
      close_punchline: "People over everything - that's a TAKE!",
    },
    {
      hook_question: "Do you think free will exists?",
      guest_answer: "I think we're just algorithms running on meat computers, pretending we have choices.",
      follow_up_question: "That's bleak!",
      follow_up_answer: "It's freeing actually. If nothing matters, everything does.",
      reaction_line: "Nihilism with a positive spin.",
      close_punchline: "Meat computer philosophy - that's a TAKE!",
    },
    {
      hook_question: "What's something you wish you learned earlier in life?",
      guest_answer: "That most people are too busy worrying about themselves to judge you.",
      follow_up_question: "How'd you figure that out?",
      follow_up_answer: "I did something embarrassing and nobody remembered. Changed my whole perspective.",
      reaction_line: "Main character syndrome cured!",
      close_punchline: "Nobody's watching - that's a TAKE!",
    },
    {
      hook_question: "Is it better to be loved or feared?",
      guest_answer: "Respected. Love fades, fear creates enemies. Respect endures.",
      follow_up_question: "That's actually smart.",
      follow_up_answer: "I read a lot of fortune cookies. They add up eventually.",
      reaction_line: "Fortune cookie wisdom is real!",
      close_punchline: "Respect over everything - that's a TAKE!",
    },
  ],
  nyc: [
    {
      hook_question: "What's the most New York thing that's ever happened to you?",
      guest_answer: "A pigeon stole my bagel right out of my hand on the L train. Made eye contact the whole time.",
      follow_up_question: "Did you fight back?",
      follow_up_answer: "It's a pigeon! What am I gonna do, press charges?",
      reaction_line: "The pigeons here are BOLD.",
      close_punchline: "Pigeon robbery - classic NYC TAKE!",
    },
    {
      hook_question: "Is paying $3000 for a studio worth it?",
      guest_answer: "If you have to ask, you can't afford it... but also no. It's never worth it.",
      follow_up_question: "Then why do you do it?",
      follow_up_answer: "Because pizza at 3am and I can walk everywhere. That's the tax.",
      reaction_line: "The NYC tax is real.",
      close_punchline: "3am pizza justifies everything - that's a TAKE!",
    },
    {
      hook_question: "Manhattan or Brooklyn - where would you live?",
      guest_answer: "Brooklyn. Manhattan is for people who think brunch is a personality trait.",
      follow_up_question: "That's fighting words for half this city.",
      follow_up_answer: "Good. Let them come to Brooklyn. We have better coffee anyway.",
      reaction_line: "Brooklyn supremacy declared!",
      close_punchline: "Brooklyn forever - borough TAKE!",
    },
    {
      hook_question: "What's the rudest thing a New Yorker has ever said to you?",
      guest_answer: "Someone told me to walk faster because I was 'ruining the flow.' I was literally jogging.",
      follow_up_question: "Did you speed up?",
      follow_up_answer: "Of course I did. Can't disrupt the flow. That's sacred.",
      reaction_line: "NYC walking etiquette is real!",
      close_punchline: "Keep it moving - that's a TAKE!",
    },
    {
      hook_question: "What food is New York actually the best at?",
      guest_answer: "Bodega sandwiches at 2am. Nothing else compares. Michelin stars can't touch it.",
      follow_up_question: "Better than fancy restaurants?",
      follow_up_answer: "A chopped cheese from a bodega at 2am after a night out? Undefeated.",
      reaction_line: "Bodega supremacy!",
      close_punchline: "Chopped cheese over fine dining - that's a TAKE!",
    },
    {
      hook_question: "What's your subway horror story?",
      guest_answer: "I once saw a guy bring a full couch onto the F train. Not a piece. The whole couch.",
      follow_up_question: "Did he sit on it?",
      follow_up_answer: "He offered people seats! It was actually kind of wholesome.",
      reaction_line: "Only in New York!",
      close_punchline: "Subway couch guy - iconic NYC TAKE!",
    },
  ],
  fitness: [
    {
      hook_question: "What's the worst gym advice you've ever heard?",
      guest_answer: "No pain, no gain. Actually, pain means you're doing something wrong.",
      follow_up_question: "But what about pushing through?",
      follow_up_answer: "Push through discomfort, not injury. There's a difference.",
      reaction_line: "Fitness wisdom dropped!",
      close_punchline: "Smart gains over pain - that's a TAKE!",
    },
    {
      hook_question: "What's your honest opinion on gym couples?",
      guest_answer: "They're either the cutest thing or the most annoying. No in between.",
      follow_up_question: "Which one are you?",
      follow_up_answer: "I'm single at the gym. Just me, my headphones, and questionable form.",
      reaction_line: "Solo gym sessions hit different!",
      close_punchline: "Gym romance is complicated - that's a TAKE!",
    },
    {
      hook_question: "What's the hardest workout you've ever done?",
      guest_answer: "CrossFit. I almost died. Literally saw my ancestors waving.",
      follow_up_question: "Would you do it again?",
      follow_up_answer: "Absolutely not. I choose peace now.",
      reaction_line: "CrossFit survivors unite!",
      close_punchline: "Peace over burpees - that's a TAKE!",
    },
    {
      hook_question: "Is the gym a personality?",
      guest_answer: "For some people, yeah. If your whole identity is lifting, who hurt you?",
      follow_up_question: "That's kind of harsh.",
      follow_up_answer: "I'm just saying - have a hobby that doesn't involve protein powder.",
      reaction_line: "Gym bro callout!",
      close_punchline: "Personality beyond gains - that's a TAKE!",
    },
  ],
  tech: [
    {
      hook_question: "Is AI going to take everyone's job?",
      guest_answer: "Only the jobs that were boring anyway. AI can have my spreadsheets.",
      follow_up_question: "What about creative jobs?",
      follow_up_answer: "AI can make art, but it can't have an existential crisis about it. We're safe.",
      reaction_line: "Hot AI take!",
      close_punchline: "Humans still got the vibes - that's a TAKE!",
    },
    {
      hook_question: "iPhone or Android?",
      guest_answer: "iPhone. Not because it's better, but because green bubbles give me anxiety.",
      follow_up_question: "That's shallow though!",
      follow_up_answer: "We live in a shallow society. I'm just adapting.",
      reaction_line: "Blue bubble gang!",
      close_punchline: "Green bubbles are chaos - that's a TAKE!",
    },
    {
      hook_question: "What's one app you couldn't live without?",
      guest_answer: "Google Maps. Without it, I'd still be wandering around Brooklyn looking for my apartment.",
      follow_up_question: "You don't know your own neighborhood?",
      follow_up_answer: "Every block looks the same! Don't judge me.",
      reaction_line: "Navigationally challenged!",
      close_punchline: "GPS dependent - that's a TAKE!",
    },
    {
      hook_question: "Social media is destroying society - agree or disagree?",
      guest_answer: "Agree, but I'm not deleting it. I need to see what my enemies are up to.",
      follow_up_question: "You have enemies?!",
      follow_up_answer: "Everyone does. Some people just call them 'people from high school.'",
      reaction_line: "Social media surveillance is real!",
      close_punchline: "Keep your enemies close - that's a TAKE!",
    },
  ],
  socialmedia: [
    {
      hook_question: "What's the most embarrassing thing you've posted online?",
      guest_answer: "A crying selfie in 2014. Captioned it 'feeling sad.' No context. Just vibes.",
      follow_up_question: "Is it still up?",
      follow_up_answer: "Deleted it, but screenshots are forever. Someone definitely has it.",
      reaction_line: "2014 was a dark time for all of us!",
      close_punchline: "Delete your history - that's a TAKE!",
    },
    {
      hook_question: "Do you think social media influencers have real jobs?",
      guest_answer: "It's more work than people think. But yeah, some of them... questionable.",
      follow_up_question: "Would you want to be one?",
      follow_up_answer: "I'd love the money, hate the parasocial relationships. Hard pass.",
      reaction_line: "Influencer reality check!",
      close_punchline: "Privacy over clout - that's a TAKE!",
    },
    {
      hook_question: "What's your screen time?",
      guest_answer: "Eight hours a day. Don't look at me like that. I'm working on it.",
      follow_up_question: "That's like a full-time job!",
      follow_up_answer: "It IS my full-time job. I doom scroll professionally.",
      reaction_line: "Screen time shame is real!",
      close_punchline: "Professional scroller - that's a TAKE!",
    },
  ],
  family: [
    {
      hook_question: "What's the most annoying thing your parents still do?",
      guest_answer: "Ask when I'm getting married. Every. Single. Phone call.",
      follow_up_question: "What do you tell them?",
      follow_up_answer: "That I'm focusing on myself. Which is code for 'I'm on dating apps failing.'",
      reaction_line: "Parent pressure is universal!",
      close_punchline: "Self-focus era - that's a TAKE!",
    },
    {
      hook_question: "Do you get along with your siblings?",
      guest_answer: "Now I do. Growing up? We were legally required to share a bathroom. War crimes happened.",
      follow_up_question: "What was the worst fight?",
      follow_up_answer: "They used my toothbrush. On purpose. I've never fully recovered.",
      reaction_line: "Sibling trauma is real!",
      close_punchline: "Bathroom battles shape character - that's a TAKE!",
    },
    {
      hook_question: "What's the best advice your parents ever gave you?",
      guest_answer: "Never go to sleep angry. And always have an emergency fund. Both have saved me.",
      follow_up_question: "Do you follow both?",
      follow_up_answer: "The emergency fund yes. The angry thing... working on it.",
      reaction_line: "Parent wisdom hits different when you're older!",
      close_punchline: "Emergency funds over everything - that's a TAKE!",
    },
  ],
  friendship: [
    {
      hook_question: "How many real friends do you think most people have?",
      guest_answer: "Like, three. Maybe five if you're lucky. Everyone else is just networking.",
      follow_up_question: "That's kind of sad.",
      follow_up_answer: "It's realistic. Quality over quantity. My three friends are elite.",
      reaction_line: "Small circle supremacy!",
      close_punchline: "Three real ones - that's a TAKE!",
    },
    {
      hook_question: "What's a friendship deal breaker?",
      guest_answer: "If they can't be happy for your success. Jealousy disguised as friendship is toxic.",
      follow_up_question: "Have you experienced that?",
      follow_up_answer: "Once. Cut them off immediately. My peace is non-negotiable.",
      reaction_line: "Boundary king/queen energy!",
      close_punchline: "No jealous friends - that's a TAKE!",
    },
    {
      hook_question: "Can men and women just be friends?",
      guest_answer: "Yes. Next question. It's 2024, we've evolved past this debate.",
      follow_up_question: "No complications ever?",
      follow_up_answer: "Complications happen in ALL friendships. Doesn't make it impossible.",
      reaction_line: "Mature take alert!",
      close_punchline: "Friendship has no gender - that's a TAKE!",
    },
  ],
  hustle: [
    {
      hook_question: "Do you have a side hustle?",
      guest_answer: "I resell sneakers. Made ten grand last year. My 9-to-5 is jealous.",
      follow_up_question: "How'd you get into that?",
      follow_up_answer: "Accidentally bought the wrong size, sold them for double. A business was born.",
      reaction_line: "Accidental entrepreneur!",
      close_punchline: "Wrong size, right income - that's a TAKE!",
    },
    {
      hook_question: "What's your opinion on hustle culture?",
      guest_answer: "It's a scam to make you feel guilty for resting. Rest is productive too.",
      follow_up_question: "But don't you have a side hustle?",
      follow_up_answer: "I hustle smart, not hard. Big difference.",
      reaction_line: "Anti-hustle hustler!",
      close_punchline: "Work smart, rest hard - that's a TAKE!",
    },
    {
      hook_question: "What would you do if money wasn't an issue?",
      guest_answer: "Open a bookstore cafe. Sell overpriced coffee and recommend books nobody asked for.",
      follow_up_question: "That sounds peaceful.",
      follow_up_answer: "That's the dream. Judge people's taste in books while making lattes.",
      reaction_line: "Cozy capitalism!",
      close_punchline: "Books and coffee forever - that's a TAKE!",
    },
  ],
  mentalhealth: [
    {
      hook_question: "What's your best mental health tip?",
      guest_answer: "Get off your phone first thing in the morning. Don't let the internet ruin your day before it starts.",
      follow_up_question: "Do you actually do that?",
      follow_up_answer: "Sometimes. I'm a work in progress. We all are.",
      reaction_line: "Morning routine wisdom!",
      close_punchline: "Phone down, peace up - that's a TAKE!",
    },
    {
      hook_question: "Do you think therapy should be normalized?",
      guest_answer: "It should be mandatory. Everyone needs someone to help them unpack their baggage.",
      follow_up_question: "Do you go to therapy?",
      follow_up_answer: "Best investment I ever made. My therapist knows everything. She's basically family.",
      reaction_line: "Therapy advocate in the wild!",
      close_punchline: "Therapy over trauma - that's a TAKE!",
    },
    {
      hook_question: "How do you deal with stress?",
      guest_answer: "I go for walks and pretend I'm the main character in a sad indie movie.",
      follow_up_question: "Does that help?",
      follow_up_answer: "Oddly, yes. Romanticizing your problems makes them feel more manageable.",
      reaction_line: "Main character coping mechanism!",
      close_punchline: "Indie movie energy - that's a TAKE!",
    },
  ],
  generational: [
    {
      hook_question: "What do you think about Gen Z?",
      guest_answer: "They're either geniuses or completely unhinged. No in between. I respect it.",
      follow_up_question: "Which one are you?",
      follow_up_answer: "I'm a millennial. We're just tired. That's our whole personality.",
      reaction_line: "Generational honesty!",
      close_punchline: "Every generation is cooked - that's a TAKE!",
    },
    {
      hook_question: "What's something older generations don't understand?",
      guest_answer: "That we can't just walk into a company and ask for a job anymore. That's not how it works.",
      follow_up_question: "Have you tried?",
      follow_up_answer: "Security escorted me out. So yeah, not recommended.",
      reaction_line: "Job market reality check!",
      close_punchline: "Apply online or get escorted - that's a TAKE!",
    },
    {
      hook_question: "Will you ever be able to afford a house?",
      guest_answer: "In this economy? I'll be lucky to afford a nice cardboard box.",
      follow_up_question: "That's dark.",
      follow_up_answer: "That's just reality. But I'll decorate the box nice. Make it cozy.",
      reaction_line: "Housing market humor!",
      close_punchline: "Cozy cardboard dreams - that's a TAKE!",
    },
  ],
  food: [
    {
      hook_question: "What's the most overrated food?",
      guest_answer: "Avocado toast. It's bread with green stuff. Why is it fifteen dollars?",
      follow_up_question: "But it's healthy!",
      follow_up_answer: "So is drinking water, and that's free.",
      reaction_line: "Avocado toast under attack!",
      close_punchline: "Free water supremacy - that's a TAKE!",
    },
    {
      hook_question: "What's your comfort food?",
      guest_answer: "Mac and cheese. The boxed kind. Don't give me that fancy stuff.",
      follow_up_question: "Not homemade?",
      follow_up_answer: "The powder cheese hits different. It's nostalgia in a box.",
      reaction_line: "Box mac and cheese defender!",
      close_punchline: "Powder cheese is elite - that's a TAKE!",
    },
    {
      hook_question: "Is pineapple on pizza acceptable?",
      guest_answer: "Not only acceptable - necessary. The sweet and savory combo is chef's kiss.",
      follow_up_question: "You're going to start a war.",
      follow_up_answer: "I've been in this fight for years. I stand on business.",
      reaction_line: "Pineapple pizza warrior!",
      close_punchline: "Hawaiian pizza forever - that's a TAKE!",
    },
    {
      hook_question: "What food would you never try?",
      guest_answer: "Anything that's still looking at me. If it has eyes, I can't eat it.",
      follow_up_question: "No whole fish?",
      follow_up_answer: "Absolutely not. We need to have a conversation before I eat something.",
      reaction_line: "Eye contact ruins the meal!",
      close_punchline: "No eye contact dining - that's a TAKE!",
    },
  ],
  music: [
    {
      hook_question: "What artist do you secretly listen to that you'd never admit?",
      guest_answer: "Nickelback. Their songs are catchy. I said what I said.",
      follow_up_question: "Nickelback?! In 2024?",
      follow_up_answer: "Photograph slaps. Fight me.",
      reaction_line: "Nickelback defender emerged!",
      close_punchline: "Nickelback redemption - that's a TAKE!",
    },
    {
      hook_question: "What's the best concert you've ever been to?",
      guest_answer: "Beyonce. Changed my life. I left a different person. She is THAT girl.",
      follow_up_question: "Worth the ticket price?",
      follow_up_answer: "I would sell a kidney for front row. No hesitation.",
      reaction_line: "Beyhive representation!",
      close_punchline: "Beyonce is church - that's a TAKE!",
    },
    {
      hook_question: "What genre of music is objectively the best?",
      guest_answer: "Hip-hop. It tells stories, addresses real issues, and you can dance to it.",
      follow_up_question: "Some people would disagree.",
      follow_up_answer: "Some people are wrong. I don't make the rules.",
      reaction_line: "Hip-hop supremacy declared!",
      close_punchline: "Bars and beats - that's a TAKE!",
    },
  ],
  sports: [
    {
      hook_question: "What's the most overhyped sport?",
      guest_answer: "Golf. You're just walking and hitting a ball occasionally. That's not a sport.",
      follow_up_question: "But it's really hard!",
      follow_up_answer: "So is parallel parking. We don't call that a sport.",
      reaction_line: "Golf catching strays!",
      close_punchline: "Golf is fancy walking - that's a TAKE!",
    },
    {
      hook_question: "Would you rather be the best at a sport nobody watches or average at a popular sport?",
      guest_answer: "Best at an obscure sport. I'd rather be a champion of curling than a bench warmer in basketball.",
      follow_up_question: "Curling?",
      follow_up_answer: "Olympic gold is Olympic gold. I'd wear that medal everywhere.",
      reaction_line: "Curling champion energy!",
      close_punchline: "Gold is gold - that's a TAKE!",
    },
    {
      hook_question: "What sport has the worst fans?",
      guest_answer: "Soccer. They literally riot. Over a ball. It's unhinged.",
      follow_up_question: "Football fans aren't better!",
      follow_up_answer: "Fair. Sports fans in general are chaotic. We all need therapy.",
      reaction_line: "All fans are unhinged!",
      close_punchline: "Sports therapy needed - that's a TAKE!",
    },
  ],
  travel: [
    {
      hook_question: "What's the most overrated travel destination?",
      guest_answer: "Paris. It smells weird, people are rude, and the Eiffel Tower is just a big antenna.",
      follow_up_question: "You did NOT just say that.",
      follow_up_answer: "The croissants are good though. I'll give them that.",
      reaction_line: "Paris slander on main!",
      close_punchline: "Croissants save Paris - that's a TAKE!",
    },
    {
      hook_question: "Window or aisle seat?",
      guest_answer: "Window. I need to see where I'm dying if the plane goes down.",
      follow_up_question: "That's morbid!",
      follow_up_answer: "It's practical. Plus the views are nice when we don't crash.",
      reaction_line: "Anxious flyer energy!",
      close_punchline: "Window or nothing - that's a TAKE!",
    },
    {
      hook_question: "What country is on your bucket list?",
      guest_answer: "Japan. I need to experience convenience stores that are actually convenient.",
      follow_up_question: "Just for the convenience stores?",
      follow_up_answer: "And the food. And the culture. But mainly the convenience stores.",
      reaction_line: "Japanese konbini dreams!",
      close_punchline: "Convenience store tourism - that's a TAKE!",
    },
  ],
};

function getRandomTemplate(topic: string): ScriptTemplate {
  const normalizedTopic = topic.toLowerCase().replace(/\s+/g, '');
  const templates = SCRIPT_TEMPLATES[normalizedTopic] || SCRIPT_TEMPLATES.hottakes;
  return templates[Math.floor(Math.random() * templates.length)];
}

export async function generateScript(topic: string): Promise<EpisodeScript> {
  const userId = getUserId();

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-script`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic }),
    });

    if (response.ok) {
      const aiScript = await response.json();
      if (aiScript.hook_question) {
        const { data, error } = await supabase
          .from('episode_scripts')
          .insert({
            user_id: userId,
            topic,
            ...aiScript,
            is_generated: true,
          })
          .select()
          .single();

        if (!error && data) {
          return data as EpisodeScript;
        }
      }
    }
  } catch {
    // Fall through to template
  }

  const template = getRandomTemplate(topic);

  const { data, error } = await supabase
    .from('episode_scripts')
    .insert({
      user_id: userId,
      topic,
      ...template,
      is_generated: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as EpisodeScript;
}

export async function saveScript(
  script: Omit<EpisodeScript, 'id' | 'user_id' | 'created_at' | 'is_generated'>
): Promise<EpisodeScript> {
  const userId = getUserId();

  const { data, error } = await supabase
    .from('episode_scripts')
    .insert({
      user_id: userId,
      ...script,
      is_generated: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as EpisodeScript;
}

export async function getScriptById(id: string): Promise<EpisodeScript | null> {
  const { data, error } = await supabase
    .from('episode_scripts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EpisodeScript | null;
}

export async function listScripts(topic?: string): Promise<EpisodeScript[]> {
  const userId = getUserId();

  let query = supabase
    .from('episode_scripts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (topic) {
    query = query.eq('topic', topic);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data || []) as EpisodeScript[];
}

export async function updateScript(
  id: string,
  updates: Partial<Omit<EpisodeScript, 'id' | 'user_id' | 'created_at'>>
): Promise<EpisodeScript> {
  const { data, error } = await supabase
    .from('episode_scripts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as EpisodeScript;
}

export async function deleteScript(id: string): Promise<void> {
  const { error } = await supabase
    .from('episode_scripts')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export function getAvailableTopics(): string[] {
  return Object.keys(SCRIPT_TEMPLATES);
}

export type ScriptFieldKey =
  | 'hook_question'
  | 'guest_answer'
  | 'follow_up_question'
  | 'follow_up_answer'
  | 'reaction_line'
  | 'close_punchline';

export async function regenerateScriptField(
  topic: string,
  field: ScriptFieldKey,
  currentScript: Partial<EpisodeScript>
): Promise<string> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-script`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic,
        regenerateField: field,
        currentScript,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result[field]) {
        return result[field];
      }
    }
  } catch {
    // Fall through to template
  }

  const template = getRandomTemplate(topic);
  return template[field];
}

export interface SavedTemplate {
  id: string;
  user_id: string;
  template_name: string;
  topic: string;
  hook_question: string;
  guest_answer: string;
  follow_up_question: string;
  follow_up_answer: string;
  reaction_line: string;
  close_punchline: string;
  tone: string | null;
  is_favorite: boolean;
  created_at: string;
}

export async function saveAsTemplate(
  script: Partial<EpisodeScript>,
  templateName: string,
  tone?: string
): Promise<SavedTemplate> {
  const userId = getUserId();

  const { data, error } = await supabase
    .from('episode_scripts')
    .insert({
      user_id: userId,
      template_name: templateName,
      topic: script.topic || 'custom',
      hook_question: script.hook_question || '',
      guest_answer: script.guest_answer || '',
      follow_up_question: script.follow_up_question || '',
      follow_up_answer: script.follow_up_answer || '',
      reaction_line: script.reaction_line || '',
      close_punchline: script.close_punchline || '',
      tone: tone || null,
      is_template: true,
      is_generated: false,
      is_favorite: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as SavedTemplate;
}

export async function listTemplates(): Promise<SavedTemplate[]> {
  const userId = getUserId();

  const { data, error } = await supabase
    .from('episode_scripts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_template', true)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as SavedTemplate[];
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('episode_scripts')
    .delete()
    .eq('id', id)
    .eq('is_template', true);

  if (error) throw new Error(error.message);
}

export async function toggleTemplateFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from('episode_scripts')
    .update({ is_favorite: isFavorite })
    .eq('id', id);

  if (error) throw new Error(error.message);
}
