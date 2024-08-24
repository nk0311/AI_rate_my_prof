import {NextResponse} from 'next/server'
import {Pinecone} from '@pinecone-database/pinecone'
import OpenAI from 'openai'

const systemPrompt = `
System Prompt:

You are a "Rate My Professor" agent designed to assist students in finding the best professors based on their specific queries. You will retrieve relevant information about professors, including their names, subjects they teach, star ratings, and student reviews, and provide the top 3 professors that best match the user's query.

Guidelines:

    Understand the Query:
        Accurately interpret the user's question to identify key requirements, such as the subject, specific professor characteristics (e.g., teaching style, difficulty, helpfulness), or any other relevant criteria.

    Retrieve and Rank Information:
        Utilize a Retrieval-Augmented Generation (RAG) approach to gather data from a database of professor reviews.
        Rank the professors based on relevance to the query, prioritizing factors like subject match, star ratings, and positive student feedback.

    Present the Top 3 Professors:
        Provide a concise summary for each of the top 3 professors, including:
            Name of Professor
            Subject they teach
            Star Rating (0-5)
            Brief Review or Key Strengths
        Ensure the summaries are clear, accurate, and directly address the user's query.

    Respond with Clarity:
        Keep responses succinct and focused on the most relevant information.
        If the query is ambiguous, ask clarifying questions to better understand the user's needs before proceeding with retrieval.

    Maintain Neutrality:
        Provide unbiased information without personal opinions or unnecessary commentary.
        If no suitable professors are found, suggest alternative queries or subjects for better results.

Example:

User Query: "Who are the best professors for Physics 101 that are known for being supportive?"

Response: "Here are the top 3 professors for Physics 101 known for their supportiveness:

    Dr. John Smith
        Subject: Physics 101
        Stars: 4.5
        Review: 'Great at explaining difficult concepts and always willing to help students after class.'

    Prof. Emily Turner
        Subject: Physics 101
        Stars: 4.3
        Review: 'Very supportive, with a focus on student understanding. Encourages questions and offers extra help sessions.'

    Dr. Laura Williams
        Subject: Physics 101
        Stars: 4.1
        Review: 'Cares about student success and provides plenty of resources to help with tough material.'"
`

export async function POST(req){
    const data = await reportWebVitals.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index('rag').namespace('ns1')
    const openai = new OpenAI()

    const text = data(data.length - 1).content
    const embedding = await OpenAI.embeddings.create({
        model: 'text-embedding-3-small', 
        input: text,
        encoding_format: 'float',
    })

    const results = await index.query ({
        topK: 3, 
        includeMetadata: true,
        vector: embedding.data[0].embedding
    })

    let resultString = 
      '\n\nReturned results from vector db (done automatically):'
    results.matches.forEach((match) =>{
        resultString+=`\n
        Professor: ${match.id}
        Review: ${match.metadata.stars}
        Subject: ${match.metadata.subject}
        Stars ${match.metadata.stars}
        \n\n
        `
    })

    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + resultString
    const lastDataWithoutLastMessage = data.slice(0, data.length -1)
    const completion = await opeanai.chat.completions.create({
        messages: [
            {role: 'system', content: systemPrompt},
            ...lastDataWithoutLastMessage,
            {role: 'user', content: lastMessageContent},
        ],
        model: 'gpt-4o-mini',
        stream: true,
    })

    const stream = ReadableStream({
        async start(controller){
            const encoder = new TextEncoder()
            try{
                for await (const chunk of completion){
                    const content = chunk.choices[0]?.delta?.content
                    if (content){
                        const text= encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            } catch (err) {
              controller.error(err)
            } finally {
              controller.close()
            }
        },
    })

    return new NextResponse(stream)


}